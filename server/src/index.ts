import dotenv from 'dotenv';
dotenv.config(); // load .env into process.env before anything reads it

import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { Room } from './room';
import { ClientMessage, MAX_PLAYERS, GameMode, GAME_MODES } from 'shared';
import { MAX_CONN_PER_IP, MAX_PAYLOAD_BYTES, RATE_LIMIT_PER_SEC, DRAIN_MAX_MS } from './constants';
import { sendMessage, sendError, sanitizeName, clampPlayers, validateMessage, randomRoomCode } from './helpers';

// ─── Environment-specific settings (from process.env) ──────────────────────
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean);

const rooms = new Map<string, Room>();
let draining = false; // during shutdown drain: reject new rooms, let existing ones finish

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
function getRoom(ws: WebSocket): { room: Room; playerId: string } | null {
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

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress ?? 'unknown';
  connByIp.set(ip, (connByIp.get(ip) ?? 0) + 1);

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
      const room = new Room(roomId, maxPlayers, mode);
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

    case 'startGame': {
      const r = getRoom(ws);
      if (!r) { sendError(ws, 'NOT_IN_ROOM'); return; }
      const err = r.room.startGame(r.playerId);
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

    case 'restartGame': {
      const r = getRoom(ws);
      if (!r) return;
      const err = r.room.restartGame(r.playerId);
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

    // No default: validateMessage() has already rejected any unknown message type.
  }
}

httpServer.listen(PORT);

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
