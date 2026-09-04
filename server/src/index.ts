import dotenv from 'dotenv';
dotenv.config(); // load .env into process.env before anything reads it

import { createServer, IncomingMessage } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { BaseRoom } from './rooms/BaseRoom';
import { BidBaaziRoom } from './rooms/bidbaazi/BidBaaziRoom';
import { ThosoRoom, THOSO_MAX_PLAYERS } from './rooms/thoso/ThosoRoom';
import { ClientMessage, MAX_PLAYERS, GameMode, GAME_MODES } from 'shared';
import { MAX_CONN_PER_IP, MAX_PAYLOAD_BYTES, RATE_LIMIT_PER_SEC, DRAIN_MAX_MS, HEARTBEAT_MS } from './constants';
import { sendMessage, sendError, sanitizeName, clampPlayers, validateMessage, randomRoomCode } from './helpers';

// ─── Environment-specific settings (from process.env) ──────────────────────
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean);
const TRUST_PROXY = process.env.TRUST_PROXY === 'true'; // trust X-Forwarded-For only behind a known reverse proxy (e.g. Render)

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

const rooms = new Map<string, BaseRoom>();
let draining = false; // during shutdown drain: reject new rooms, let existing ones finish

// Game-factory: maps a registry game id to its Room constructor.
// Add a new game by adding an entry here (and its Room class import).
const ROOM_FACTORIES: Record<string, (id: string, maxPlayers: number, mode: GameMode) => BaseRoom> = {
  'bidbaazi': (id, maxPlayers, mode) => new BidBaaziRoom(id, maxPlayers, mode),
  'thoso': (id, maxPlayers) => new ThosoRoom(id, Math.min(maxPlayers, THOSO_MAX_PLAYERS)),
};

// Generate a unique room code (retries on the rare collision).
function generateRoomId(): string {
  const id = randomRoomCode();
  return rooms.has(id) ? generateRoomId() : id;
}

// Track which ws belongs to which player/room
const wsContext = new WeakMap<WebSocket, { playerId: string; roomId: string }>();

// Release the seat a socket currently holds (on explicit leave, or when it hops rooms)
function releaseOldSeat(ws: WebSocket): void {
  const ctx = wsContext.get(ws);
  if (!ctx) return;
  rooms.get(ctx.roomId)?.leaveRoom(ctx.playerId);
  wsContext.delete(ws);
}

// Resolve the room + player for a socket that should already be seated.
function getRoom(ws: WebSocket): { room: BaseRoom; playerId: string } | null {
  const ctx = wsContext.get(ws);
  if (!ctx) return null;
  const room = rooms.get(ctx.roomId);
  if (!room) return null;
  return { room, playerId: ctx.playerId };
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
    try {
      handleMessage(ws, msg);
    } catch {
      sendError(ws, 'BAD_MESSAGE');
    }
  });
});

function handleMessage(ws: WebSocket, msg: ClientMessage): void {
  const invalid = validateMessage(msg);
  if (invalid) { sendError(ws, invalid); return; }
  switch (msg.type) {
    case 'createRoom': {
      if (draining) { sendError(ws, 'JOIN_FAILED'); return; } // shutting down: no new rooms
      releaseOldSeat(ws); // hopping rooms: drop any old seat first
      const name = sanitizeName(msg.name);
      if (!name) { sendError(ws, 'INVALID_NAME'); return; }
      const roomId = generateRoomId();
      const maxPlayers = clampPlayers(typeof msg.maxPlayers === 'number' ? msg.maxPlayers : MAX_PLAYERS);
      const mode: GameMode = GAME_MODES.some(m => m.id === msg.mode) ? (msg.mode as GameMode) : 'classic';
      const game = typeof msg.game === 'string' ? msg.game : 'bidbaazi';
      const factory = ROOM_FACTORIES[game];
      if (!factory) { sendError(ws, 'JOIN_FAILED'); return; } // unknown or not-yet-available game
      const room = factory(roomId, maxPlayers, mode);
      room.onDestroy = () => { rooms.delete(roomId); };
      rooms.set(roomId, room);

      const seat = room.addPlayer(ws, name, true);
      if (!seat) { sendError(ws, 'JOIN_FAILED'); return; }
      wsContext.set(ws, { playerId: seat.player.id, roomId });
      sendMessage(ws, { type: 'joined', playerId: seat.player.id, token: seat.token, roomId });
      room.broadcastState();
      break;
    }

    case 'joinRoom': {
      const name = sanitizeName(msg.name);
      const roomId = msg.roomId.toUpperCase();
      if (!name) { sendError(ws, 'INVALID_NAME'); return; }
      const room = rooms.get(roomId);
      if (!room) { sendError(ws, 'ROOM_NOT_FOUND'); return; }
      if (room.getPhase() !== 'LOBBY') { sendError(ws, 'GAME_STARTED'); return; }
      if (room.isFull) { sendError(ws, 'ROOM_FULL'); return; }
      releaseOldSeat(ws); // hopping rooms: drop any old seat first
      const seat = room.addPlayer(ws, name);
      if (!seat) { sendError(ws, 'JOIN_FAILED'); return; }
      wsContext.set(ws, { playerId: seat.player.id, roomId });
      sendMessage(ws, { type: 'joined', playerId: seat.player.id, token: seat.token, roomId });
      room.broadcastState();
      break;
    }

    case 'reconnect': {
      const roomId = msg.roomId.toUpperCase();
      const room = rooms.get(roomId);
      if (!room) { sendError(ws, 'ROOM_NOT_FOUND'); return; }
      const seat = room.reconnect(ws, msg.token);
      if (!seat) { sendError(ws, 'INVALID_TOKEN'); return; }
      wsContext.set(ws, { playerId: seat.player.id, roomId });
      sendMessage(ws, { type: 'joined', playerId: seat.player.id, token: seat.token, roomId });
      room.sendState(ws, seat.player.id);
      room.resendPhaseExtras(ws); // re-send GAME_OVER / ROUND_SCORING payloads a returning player missed
      room.broadcastState();
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

    default: {
      const r = getRoom(ws);
      if (!r) { sendError(ws, 'NOT_IN_ROOM'); return; }
      const err = r.room.handleGameMessage(r.playerId, msg);
      if (err) sendError(ws, err);
    }
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

// Graceful shutdown for clean redeploys: stop accepting new rooms, let active
// rooms drain (up to DRAIN_MAX_MS), then close sockets + servers and exit.
function shutdown(): void {
  draining = true;
  const deadline = Date.now() + DRAIN_MAX_MS;
  const finish = () => {
    for (const client of wss.clients) { try { client.close(1001, 'server shutting down'); } catch { /* ignore */ } }
    wss.close(() => httpServer.close(() => process.exit(0)));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  const tick = () => {
    if (rooms.size === 0 || Date.now() >= deadline) finish();
    else setTimeout(tick, 1000).unref();
  };
  tick();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
