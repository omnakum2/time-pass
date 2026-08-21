import dotenv from 'dotenv';
dotenv.config(); // load .env into process.env before anything reads it

import { createServer, IncomingMessage } from 'http';
import { randomInt } from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { Room } from './room';
import {
  ClientMessage, MAX_PLAYERS, GameMode, GAME_MODES, UserAccount,
  isValidBet, isValidStartingChips, buyInTotal, DEFAULT_STARTING_CHIPS,
} from 'shared';
import { MAX_CONN_PER_IP, MAX_PAYLOAD_BYTES, RATE_LIMIT_PER_SEC, DRAIN_MAX_MS, HEARTBEAT_MS } from './constants';
import { sendMessage, sendError, sanitizeName, clampPlayers, validateMessage, randomRoomCode } from './helpers';
import { getIdentity, istWeekKey, istToday } from './firebase';

// ─── Environment-specific settings (from process.env) ──────────────────────
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean);
const TRUST_PROXY = process.env.TRUST_PROXY === 'true'; // trust X-Forwarded-For only behind a known reverse proxy (e.g. Render)
// V3 Phase 6: the rewarded-ad top-up stays OFF until a real ad SDK is wired. Only when this
// env flag is 'true' does claimAdReward credit Coins (otherwise it throws AD_REWARD_DISABLED).
const AD_REWARD_ENABLED = process.env.AD_REWARD_ENABLED === 'true';

// Resolve the real client IP for per-IP limits. Behind a trusted proxy the
// socket address is the proxy's, so read the leftmost X-Forwarded-For entry;
// otherwise trusting that header would let clients spoof their IP.
function clientIp(req: IncomingMessage): string {
  if (TRUST_PROXY) {
    const xff = req.headers['x-forwarded-for'];
    const first = (Array.isArray(xff) ? xff[0] : xff)?.split(',')[0].trim();
    if (first) return first;
  }
  return req.socket.remoteAddress ?? 'unknown';
}

const rooms = new Map<string, Room>();
let draining = false; // during shutdown drain: reject new rooms, let existing ones finish

// Generate a unique room code (retries on the rare collision).
function generateRoomId(): string {
  const id = randomRoomCode();
  return rooms.has(id) ? generateRoomId() : id;
}

// Track which ws belongs to which player/room (+ optional authenticated identity)
const wsContext = new WeakMap<WebSocket, { playerId: string; roomId: string; uid?: string; account?: UserAccount }>();

// Release the seat a socket currently holds (on explicit leave, or when it hops rooms)
function releaseOldSeat(ws: WebSocket): void {
  const ctx = wsContext.get(ws);
  if (!ctx) return;
  rooms.get(ctx.roomId)?.leaveRoom(ctx.playerId);
  wsContext.delete(ws);
}

// Resolve the room + player for a socket that should already be seated.
function getRoom(ws: WebSocket): { room: Room; playerId: string } | null {
  const ctx = wsContext.get(ws);
  if (!ctx) return null;
  const room = rooms.get(ctx.roomId);
  if (!room) return null;
  return { room, playerId: ctx.playerId };
}

// ─── Reward helpers ──────────────────────────────────────────────────────────
// (istToday now lives in ./firebase — imported above — so room.ts can share it without a
// circular import; the reward handlers below still call it exactly as before.)

// Resolve the authenticated identity for a reward message (null = not signed in).
async function rewardIdentity(idToken?: string): Promise<{ uid: string; name: string } | null> {
  if (!idToken) return null;
  return getIdentity().verifyIdToken(idToken);
}

const httpServer = createServer((req, res) => {
  // Lightweight keep-alive/health probe — independent of any game state.
  if (req.url === '/health') {
    console.log('[health] ping', new Date().toISOString());
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Prediction Card Game relay');
});

const wss = new WebSocketServer({
  server: httpServer,
  maxPayload: MAX_PAYLOAD_BYTES, // messages are tiny; reject oversized payloads
  verifyClient: (info, cb) => {
    if (ALLOWED_ORIGINS.length === 0) return cb(true);           // no allowlist configured (dev) = allow
    cb(!!info.origin && ALLOWED_ORIGINS.includes(info.origin));  // else require a listed Origin (anti-CSWSH)
  },
});

// Per-IP concurrent-connection cap + per-connection message rate limit
const connByIp = new Map<string, number>();
const rate = new WeakMap<WebSocket, { count: number; windowStart: number }>();

// Heartbeat liveness: true = a pong was seen since the last ping (see heartbeat loop below)
const alive = new WeakMap<WebSocket, boolean>();

wss.on('connection', (ws, req) => {
  const ip = clientIp(req);
  connByIp.set(ip, (connByIp.get(ip) ?? 0) + 1);

  // Heartbeat liveness: a fresh socket is alive; each pong marks it alive again.
  alive.set(ws, true);
  ws.on('pong', () => alive.set(ws, true));

  ws.on('close', () => {
    const left = (connByIp.get(ip) ?? 1) - 1;
    if (left <= 0) connByIp.delete(ip); else connByIp.set(ip, left);
    const ctx = wsContext.get(ws);
    if (ctx) rooms.get(ctx.roomId)?.disconnect(ctx.playerId, ws);
  });
  ws.on('error', () => {
    const ctx = wsContext.get(ws);
    if (ctx) rooms.get(ctx.roomId)?.disconnect(ctx.playerId, ws);
  });

  if ((connByIp.get(ip) ?? 0) > MAX_CONN_PER_IP) { ws.close(1013, 'Too many connections'); return; }

  ws.on('message', (raw) => {
    // rate limit — silently drop excess messages within a 1s window
    const now = Date.now();
    let r = rate.get(ws);
    if (!r || now - r.windowStart >= 1000) { r = { count: 0, windowStart: now }; rate.set(ws, r); }
    if (++r.count > RATE_LIMIT_PER_SEC) return;

    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString()) as ClientMessage;
    } catch {
      sendError(ws, 'BAD_MESSAGE');
      return;
    }
    void handleMessage(ws, msg).catch(() => sendError(ws, 'BAD_MESSAGE'));
  });
});

async function handleMessage(ws: WebSocket, msg: ClientMessage): Promise<void> {
  const invalid = validateMessage(msg);
  if (invalid) { sendError(ws, invalid); return; }
  switch (msg.type) {
    case 'createRoom': {
      if (draining) { sendError(ws, 'JOIN_FAILED'); return; } // shutting down: no new rooms
      // V3: authenticate if a token was supplied; anonymous otherwise (non-breaking).
      let uid: string | undefined, account: UserAccount | undefined;
      if (msg.idToken) {
        const v = await getIdentity().verifyIdToken(msg.idToken);
        if (!v) { sendError(ws, 'AUTH_FAILED'); return; }
        account = await getIdentity().getOrCreateUser(v.uid, v.name);
        uid = v.uid;
      }
      releaseOldSeat(ws); // hopping rooms: drop any old seat first
      const name = sanitizeName(msg.name);
      if (!name) { sendError(ws, 'INVALID_NAME'); return; }
      const roomId = generateRoomId();
      const maxPlayers = clampPlayers(typeof msg.maxPlayers === 'number' ? msg.maxPlayers : MAX_PLAYERS);
      const mode: GameMode = GAME_MODES.some(m => m.id === msg.mode) ? (msg.mode as GameMode) : 'classic';
      // Coin Rush: validate the coin buy-in + starting-chip stack, and require the host to
      // be a signed-in account that can afford the buy-in (the debit happens at startGame).
      let betAmount = 0, startingChips = DEFAULT_STARTING_CHIPS;
      if (mode === 'coinRush') {
        const bet = msg.betAmount;
        const chips = msg.startingChips ?? DEFAULT_STARTING_CHIPS;
        if (typeof bet !== 'number' || !isValidBet(bet) || !isValidStartingChips(chips)) {
          sendError(ws, 'INVALID_SETTINGS'); return;
        }
        if (!account || account.coins < buyInTotal(bet)) { sendError(ws, 'INSUFFICIENT_BALANCE'); return; }
        betAmount = bet; startingChips = chips;
      }
      const room = new Room(roomId, maxPlayers, mode);
      if (mode === 'coinRush') room.setCurrencyConfig(betAmount, startingChips);
      room.onDestroy = () => { rooms.delete(roomId); };
      rooms.set(roomId, room);

      const seat = room.addPlayer(ws, name, true, uid);
      if (!seat) { sendError(ws, 'JOIN_FAILED'); return; }
      wsContext.set(ws, { playerId: seat.player.id, roomId, uid, account });
      sendMessage(ws, { type: 'joined', playerId: seat.player.id, token: seat.token, roomId });
      if (account) sendMessage(ws, { type: 'account', account });
      room.broadcastState();
      break;
    }

    case 'joinRoom': {
      // V3: authenticate if a token was supplied; anonymous otherwise (non-breaking).
      let uid: string | undefined, account: UserAccount | undefined;
      if (msg.idToken) {
        const v = await getIdentity().verifyIdToken(msg.idToken);
        if (!v) { sendError(ws, 'AUTH_FAILED'); return; }
        account = await getIdentity().getOrCreateUser(v.uid, v.name);
        uid = v.uid;
      }
      const name = sanitizeName(msg.name);
      const roomId = msg.roomId.toUpperCase();
      if (!name) { sendError(ws, 'INVALID_NAME'); return; }
      const room = rooms.get(roomId);
      if (!room) { sendError(ws, 'ROOM_NOT_FOUND'); return; }
      if (room.getPhase() !== 'LOBBY') { sendError(ws, 'GAME_STARTED'); return; }
      if (room.isFull) { sendError(ws, 'ROOM_FULL'); return; }
      // Coin Rush: must be a signed-in account able to afford the buy-in (authoritative
      // re-check is the debitBuyIn txn at startGame).
      if (room.getMode() === 'coinRush' && (!account || account.coins < buyInTotal(room.getBetAmount()))) {
        sendError(ws, 'INSUFFICIENT_BALANCE'); return;
      }
      releaseOldSeat(ws); // hopping rooms: drop any old seat first
      const seat = room.addPlayer(ws, name, false, uid);
      if (!seat) { sendError(ws, 'JOIN_FAILED'); return; }
      wsContext.set(ws, { playerId: seat.player.id, roomId, uid, account });
      sendMessage(ws, { type: 'joined', playerId: seat.player.id, token: seat.token, roomId });
      if (account) sendMessage(ws, { type: 'account', account });
      room.broadcastState();
      break;
    }

    case 'reconnect': {
      // V3: authenticate if a token was supplied; anonymous otherwise (non-breaking).
      let uid: string | undefined, account: UserAccount | undefined;
      if (msg.idToken) {
        const v = await getIdentity().verifyIdToken(msg.idToken);
        if (!v) { sendError(ws, 'AUTH_FAILED'); return; }
        account = await getIdentity().getOrCreateUser(v.uid, v.name);
        uid = v.uid;
      }
      const roomId = msg.roomId.toUpperCase();
      const room = rooms.get(roomId);
      if (!room) { sendError(ws, 'ROOM_NOT_FOUND'); return; }
      const seat = room.reconnect(ws, msg.token, uid);
      if (!seat) { sendError(ws, 'INVALID_TOKEN'); return; }
      wsContext.set(ws, { playerId: seat.player.id, roomId, uid, account });
      sendMessage(ws, { type: 'joined', playerId: seat.player.id, token: seat.token, roomId });
      if (account) sendMessage(ws, { type: 'account', account });
      room.sendState(ws, seat.player.id);
      room.resendPhaseExtras(ws); // re-send GAME_OVER / ROUND_SCORING payloads a returning player missed
      room.broadcastState();
      break;
    }

    case 'startGame': {
      const r = getRoom(ws);
      if (!r) { sendError(ws, 'NOT_IN_ROOM'); return; }
      const err = await r.room.startGame(r.playerId); // async: coinRush debits buy-ins first
      if (err) sendError(ws, err);
      break;
    }

    case 'placeBid': {
      const r = getRoom(ws);
      if (!r) return;
      const err = r.room.placeBid(r.playerId, msg.bid);
      if (err) sendError(ws, err);
      break;
    }

    case 'selectTrump': {
      const r = getRoom(ws);
      if (!r) return;
      const err = r.room.selectTrump(r.playerId, msg.kind, msg.suit);
      if (err) sendError(ws, err);
      break;
    }

    case 'playCard': {
      const r = getRoom(ws);
      if (!r) return;
      const err = r.room.playCard(r.playerId, msg.cardId);
      if (err) sendError(ws, err);
      break;
    }

    case 'pushBid': {
      const r = getRoom(ws);
      if (!r) return;
      const err = r.room.pushBid(r.playerId, msg.push);
      if (err) sendError(ws, err);
      break;
    }

    case 'restartGame': {
      const r = getRoom(ws);
      if (!r) return;
      const err = r.room.restartGame(r.playerId);
      if (err) sendError(ws, err);
      break;
    }

    case 'updateRoomSettings': {
      const r = getRoom(ws);
      if (!r) return;
      const err = r.room.updateRoomSettings(r.playerId, msg.maxPlayers, msg.mode, msg.betAmount, msg.startingChips);
      if (err) sendError(ws, err);
      break;
    }

    case 'leaveRoom': {
      releaseOldSeat(ws);
      break;
    }

    case 'quickMessage': {
      const r = getRoom(ws);
      if (!r) return;
      r.room.quickMessage(r.playerId, msg.id);
      break;
    }

    case 'getRewards': {
      const id = await rewardIdentity(msg.idToken);
      if (!id) { sendError(ws, 'NOT_AUTHENTICATED'); return; }
      await getIdentity().getOrCreateUser(id.uid, id.name); // ensure the doc exists
      const rs = await getIdentity().getRewardsStatus(id.uid, istToday());
      sendMessage(ws, { type: 'rewardsStatus', ...rs });
      break;
    }

    case 'claimDaily': {
      const id = await rewardIdentity(msg.idToken);
      if (!id) { sendError(ws, 'NOT_AUTHENTICATED'); return; }
      const r = await getIdentity().claimDaily(id.uid, istToday());
      sendMessage(ws, { type: 'dailyReward', ...r });
      break;
    }

    case 'spin': {
      const id = await rewardIdentity(msg.idToken);
      if (!id) { sendError(ws, 'NOT_AUTHENTICATED'); return; }
      const rand = randomInt(0, 1_000_000) / 1_000_000; // crypto rng in [0,1)
      try {
        const r = await getIdentity().spin(id.uid, istToday(), rand);
        sendMessage(ws, { type: 'spinResult', ...r });
      } catch (e) {
        const m = (e as Error).message;
        sendError(ws, m === 'NO_SPINS_LEFT' || m === 'INSUFFICIENT_COINS' ? m as any : 'BAD_MESSAGE');
      }
      break;
    }

    case 'convertGems': {
      const id = await rewardIdentity(msg.idToken);
      if (!id) { sendError(ws, 'NOT_AUTHENTICATED'); return; }
      // Cheap pre-txn guard: reject non-numeric / non-finite / non-integer / <1 amounts
      // (the convertGems txn re-validates against the held balance authoritatively).
      if (typeof msg.gems !== 'number' || !Number.isInteger(msg.gems) || msg.gems < 1) {
        sendError(ws, 'INVALID_AMOUNT'); return;
      }
      try {
        const acc = await getIdentity().convertGems(id.uid, msg.gems);
        sendMessage(ws, { type: 'account', account: acc });
      } catch (e) {
        const m = (e as Error).message;
        if (m === 'INSUFFICIENT_GEMS' || m === 'INVALID_AMOUNT') sendError(ws, m);
        else sendError(ws, 'BAD_MESSAGE');
      }
      break;
    }

    case 'getLeaderboard': {
      // Anonymous viewing is allowed: an absent/invalid token → requesterUid null
      // (all rows isYou=false, you=null). A valid token identifies the requester's row.
      let requesterUid: string | null = null;
      if (msg.idToken) {
        const v = await getIdentity().verifyIdToken(msg.idToken);
        if (v) requesterUid = v.uid;
      }
      const lb = await getIdentity().getLeaderboard(istWeekKey(), requesterUid);
      sendMessage(ws, { type: 'leaderboard', week: lb.week, entries: lb.entries, you: lb.you });
      break;
    }

    case 'getReferral': {
      const id = await rewardIdentity(msg.idToken);
      if (!id) { sendError(ws, 'NOT_AUTHENTICATED'); return; }
      sendMessage(ws, { type: 'referralStatus', ...await getIdentity().getReferral(id.uid) });
      break;
    }

    case 'applyReferral': {
      const id = await rewardIdentity(msg.idToken);
      if (!id) { sendError(ws, 'NOT_AUTHENTICATED'); return; }
      try {
        const r = await getIdentity().applyReferral(id.uid, msg.code);
        // Both the updated wallet and the new referral standing (referredBy now true).
        sendMessage(ws, { type: 'account', account: r.account });
        sendMessage(ws, { type: 'referralStatus', ...r.status });
      } catch (e) {
        const m = (e as Error).message;
        if (m === 'INVALID_REFERRAL' || m === 'ALREADY_REFERRED' || m === 'SELF_REFERRAL') sendError(ws, m);
        else sendError(ws, 'BAD_MESSAGE');
      }
      break;
    }

    case 'adReward': {
      const id = await rewardIdentity(msg.idToken);
      if (!id) { sendError(ws, 'NOT_AUTHENTICATED'); return; }
      try {
        const acc = await getIdentity().claimAdReward(id.uid, istToday(), AD_REWARD_ENABLED);
        sendMessage(ws, { type: 'account', account: acc });
      } catch (e) {
        const m = (e as Error).message;
        if (m === 'AD_REWARD_DISABLED' || m === 'AD_REWARD_LIMIT') sendError(ws, m);
        else sendError(ws, 'BAD_MESSAGE');
      }
      break;
    }

    // No default: validateMessage() has already rejected any unknown message type.
  }
}

httpServer.listen(PORT);

// WebSocket heartbeat: ping every idle socket so proxies/NAT (Render/Cloudflare)
// can't silently drop it, and reap any socket that missed the previous ping.
const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (alive.get(ws) === false) { ws.terminate(); return; } // missed the previous ping → dead → reap
    if (ws.readyState !== WebSocket.OPEN) return; // skip a mid-close (replaced/closing) socket
    alive.set(ws, false);
    ws.ping();
  });
}, HEARTBEAT_MS);
wss.on('close', () => clearInterval(heartbeat));

// Coin Rush crash-safety sweep: periodically refund any reservation left 'open' past its
// max age (e.g. a server crash between debit and settle). Only runs when Firebase is
// configured — the reservation ledger lives in Firestore. Errors are swallowed (best-effort).
const FIREBASE_CONFIGURED = !!(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY);
const STUCK_SWEEP_INTERVAL_MS = 15 * 60 * 1000; // every 15 min
const STUCK_RESERVATION_MAX_AGE_MS = 60 * 60 * 1000; // refund reservations open > 1 hour
let stuckSweep: ReturnType<typeof setInterval> | null = null;
if (FIREBASE_CONFIGURED) {
  stuckSweep = setInterval(() => {
    void getIdentity().refundStuckReservations(STUCK_RESERVATION_MAX_AGE_MS).catch(() => { /* best-effort; retried next sweep */ });
  }, STUCK_SWEEP_INTERVAL_MS);
  stuckSweep.unref?.(); // don't keep the process alive for the sweep alone
}
wss.on('close', () => { if (stuckSweep) clearInterval(stuckSweep); });

// Graceful shutdown for clean redeploys: stop accepting new rooms, let active
// rooms drain (up to DRAIN_MAX_MS), then close sockets + servers and exit.
function shutdown(): void {
  draining = true;
  const deadline = Date.now() + DRAIN_MAX_MS;
  const finish = () => {
    // Coin Rush: refund any game whose reservation is still open (can't settle mid-shutdown).
    // abortGame is a guarded no-op for settled games and the other 4 modes.
    void Promise.allSettled([...rooms.values()].map(r => r.abortGame())).finally(() => {
      for (const client of wss.clients) { try { client.close(1001, 'server shutting down'); } catch { /* ignore */ } }
      wss.close(() => httpServer.close(() => process.exit(0)));
      setTimeout(() => process.exit(0), 5000).unref();
    });
  };
  const tick = () => {
    if (rooms.size === 0 || Date.now() >= deadline) finish();
    else setTimeout(tick, 1000).unref();
  };
  tick();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
