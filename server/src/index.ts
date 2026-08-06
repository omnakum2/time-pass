import dotenv from 'dotenv';
dotenv.config(); // load .env into process.env before anything reads it

import { createServer } from 'http';
import { randomInt } from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { Room } from './room';
import { config } from './config';
import { ClientMessage, ServerMessage, ErrorCode, ERROR_MESSAGES } from 'shared';

// ─── Environment-specific settings (from process.env) ──────────────────────
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean);

const rooms = new Map<string, Room>();

// Generate a 6-char uppercase room code (crypto-random, non-enumerable)
function generateRoomId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i++) id += chars[randomInt(chars.length)];
  return rooms.has(id) ? generateRoomId() : id;
}

// Track which ws belongs to which player/room
const wsContext = new WeakMap<WebSocket, { playerId: string; roomId: string }>();

function send(ws: WebSocket, msg: ServerMessage): void {
  try { ws.send(JSON.stringify(msg)); } catch { /* ignore */ }
}

function sendError(ws: WebSocket, code: ErrorCode): void {
  send(ws, { type: "error", code, message: ERROR_MESSAGES[code] });
}

// Release the seat a socket currently holds (on explicit leave, or when it hops rooms)
function releaseOldSeat(ws: WebSocket): void {
  const ctx = wsContext.get(ws);
  if (!ctx) return;
  rooms.get(ctx.roomId)?.leaveRoom(ctx.playerId);
  wsContext.delete(ws);
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
  maxPayload: config.maxPayloadBytes, // messages are tiny; reject oversized payloads
  verifyClient: (info, cb) => {
    if (ALLOWED_ORIGINS.length === 0) return cb(true);           // no allowlist configured (dev) = allow
    cb(!!info.origin && ALLOWED_ORIGINS.includes(info.origin));  // else require a listed Origin (anti-CSWSH)
  },
});

// Per-IP concurrent-connection cap + per-connection message rate limit
const MAX_CONN_PER_IP = config.maxConnPerIp;
const RATE_LIMIT = config.rateLimitPerSec; // messages / second / connection
const connByIp = new Map<string, number>();
const rate = new WeakMap<WebSocket, { count: number; windowStart: number }>();

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress ?? 'unknown';
  connByIp.set(ip, (connByIp.get(ip) ?? 0) + 1);

  ws.on('close', () => {
    const left = (connByIp.get(ip) ?? 1) - 1;
    if (left <= 0) connByIp.delete(ip); else connByIp.set(ip, left);
    const ctx = wsContext.get(ws);
    if (ctx) rooms.get(ctx.roomId)?.disconnect(ctx.playerId);
  });
  ws.on('error', () => {
    const ctx = wsContext.get(ws);
    if (ctx) rooms.get(ctx.roomId)?.disconnect(ctx.playerId);
  });

  if ((connByIp.get(ip) ?? 0) > MAX_CONN_PER_IP) { ws.close(1013, 'Too many connections'); return; }

  ws.on('message', (raw) => {
    // rate limit — silently drop excess messages within a 1s window
    const now = Date.now();
    let r = rate.get(ws);
    if (!r || now - r.windowStart >= 1000) { r = { count: 0, windowStart: now }; rate.set(ws, r); }
    if (++r.count > RATE_LIMIT) return;

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
  switch (msg.type) {
    case 'createRoom': {
      if (typeof msg.name !== 'string') { sendError(ws, 'INVALID_NAME'); return; }
      releaseOldSeat(ws); // hopping rooms: drop any old seat first
      const name = msg.name.trim().slice(0, 20);
      if (!name) { sendError(ws, 'INVALID_NAME'); return; }
      const roomId = generateRoomId();
      const maxPlayers = typeof msg.maxPlayers === 'number'
        ? Math.min(7, Math.max(2, Math.floor(msg.maxPlayers)))
        : 7;
      const room = new Room(roomId, maxPlayers);
      room.onDestroy = () => { rooms.delete(roomId); };
      rooms.set(roomId, room);

      const seat = room.addPlayer(ws, name, true);
      if (!seat) { sendError(ws, 'JOIN_FAILED'); return; }
      wsContext.set(ws, { playerId: seat.player.id, roomId });
      send(ws, { type: 'joined', playerId: seat.player.id, token: seat.token, roomId });
      room.broadcastState();
      break;
    }

    case 'joinRoom': {
      if (typeof msg.name !== 'string' || typeof msg.roomId !== 'string') { sendError(ws, 'INVALID_NAME'); return; }
      const name = msg.name.trim().slice(0, 20);
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
      send(ws, { type: 'joined', playerId: seat.player.id, token: seat.token, roomId });
      room.broadcastState();
      break;
    }

    case 'reconnect': {
      if (typeof msg.roomId !== 'string' || typeof msg.token !== 'string') { sendError(ws, 'INVALID_TOKEN'); return; }
      const roomId = msg.roomId.toUpperCase();
      const room = rooms.get(roomId);
      if (!room) { sendError(ws, 'ROOM_NOT_FOUND'); return; }
      const seat = room.reconnect(ws, msg.token);
      if (!seat) { sendError(ws, 'INVALID_TOKEN'); return; }
      wsContext.set(ws, { playerId: seat.player.id, roomId });
      send(ws, { type: 'joined', playerId: seat.player.id, token: seat.token, roomId });
      room.sendState(ws, seat.player.id);
      room.broadcastState();
      break;
    }

    case 'startGame': {
      const ctx = wsContext.get(ws);
      if (!ctx) { sendError(ws, 'NOT_IN_ROOM'); return; }
      const room = rooms.get(ctx.roomId);
      if (!room) return;
      const err = room.startGame(ctx.playerId);
      if (err) sendError(ws, err);
      break;
    }

    case 'placeBid': {
      const ctx = wsContext.get(ws);
      if (!ctx) return;
      const room = rooms.get(ctx.roomId);
      if (!room) return;
      const err = room.placeBid(ctx.playerId, msg.bid);
      if (err) sendError(ws, err);
      break;
    }

    case 'playCard': {
      const ctx = wsContext.get(ws);
      if (!ctx) return;
      if (typeof msg.cardId !== 'string') { sendError(ws, 'BAD_MESSAGE'); return; }
      const room = rooms.get(ctx.roomId);
      if (!room) return;
      const err = room.playCard(ctx.playerId, msg.cardId);
      if (err) sendError(ws, err);
      break;
    }

    case 'restartGame': {
      const ctx = wsContext.get(ws);
      if (!ctx) return;
      const room = rooms.get(ctx.roomId);
      if (!room) return;
      const err = room.restartGame(ctx.playerId);
      if (err) sendError(ws, err);
      break;
    }

    case 'leaveRoom': {
      releaseOldSeat(ws);
      break;
    }

    default: {
      sendError(ws, 'BAD_MESSAGE');
    }
  }
}

httpServer.listen(PORT);

// Graceful shutdown for clean redeploys
function shutdown(): void {
  for (const client of wss.clients) { try { client.close(1001, 'server shutting down'); } catch { /* ignore */ } }
  wss.close(() => httpServer.close(() => process.exit(0)));
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
