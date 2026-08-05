import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { Room } from './room';
import { ClientMessage, ServerMessage } from 'shared';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

const rooms = new Map<string, Room>();

// Generate a 6-char uppercase room code
function generateRoomId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return rooms.has(id) ? generateRoomId() : id;
}

// Track which ws belongs to which player/room
const wsContext = new WeakMap<WebSocket, { playerId: string; roomId: string }>();

function send(ws: WebSocket, msg: ServerMessage): void {
  try { ws.send(JSON.stringify(msg)); } catch { /* ignore */ }
}

const httpServer = createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Prediction Card Game relay');
});

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString()) as ClientMessage;
    } catch {
      send(ws, { type: 'error', code: 'PARSE_ERROR', message: 'Invalid JSON' });
      return;
    }

    handleMessage(ws, msg);
  });

  ws.on('close', () => {
    const ctx = wsContext.get(ws);
    if (!ctx) return;
    const room = rooms.get(ctx.roomId);
    if (room) {
      room.disconnect(ctx.playerId);
    }
  });

  ws.on('error', () => {
    const ctx = wsContext.get(ws);
    if (!ctx) return;
    const room = rooms.get(ctx.roomId);
    if (room) room.disconnect(ctx.playerId);
  });
});

function handleMessage(ws: WebSocket, msg: ClientMessage): void {
  switch (msg.type) {
    case 'createRoom': {
      const name = msg.name?.trim().slice(0, 20);
      if (!name) {
        send(ws, { type: 'error', code: 'INVALID_NAME', message: 'Name is required' });
        return;
      }
      const roomId = generateRoomId();
      const maxPlayers = typeof msg.maxPlayers === 'number'
        ? Math.min(7, Math.max(2, Math.floor(msg.maxPlayers)))
        : 7;
      const room = new Room(roomId, maxPlayers);
      room.onDestroy = () => { rooms.delete(roomId); console.log(`Room ${roomId} destroyed`); };
      rooms.set(roomId, room);

      const seat = room.addPlayer(ws, name, true);
      if (!seat) {
        send(ws, { type: 'error', code: 'JOIN_FAILED', message: 'Could not create room' });
        return;
      }
      wsContext.set(ws, { playerId: seat.player.id, roomId });
      send(ws, { type: 'joined', playerId: seat.player.id, token: seat.token, roomId });
      room.broadcastState();
      console.log(`Room ${roomId} created by ${name}`);
      break;
    }

    case 'joinRoom': {
      const name = msg.name?.trim().slice(0, 20);
      const roomId = msg.roomId?.toUpperCase();
      if (!name) {
        send(ws, { type: 'error', code: 'INVALID_NAME', message: 'Name is required' });
        return;
      }
      const room = rooms.get(roomId);
      if (!room) {
        send(ws, { type: 'error', code: 'ROOM_NOT_FOUND', message: 'Room not found' });
        return;
      }
      if (room.getPhase() !== 'LOBBY') {
        send(ws, { type: 'error', code: 'GAME_STARTED', message: 'Game already started' });
        return;
      }
      if (room.isFull) {
        send(ws, { type: 'error', code: 'ROOM_FULL', message: 'Room is full' });
        return;
      }
      const seat = room.addPlayer(ws, name);
      if (!seat) {
        send(ws, { type: 'error', code: 'JOIN_FAILED', message: 'Could not join room' });
        return;
      }
      wsContext.set(ws, { playerId: seat.player.id, roomId });
      send(ws, { type: 'joined', playerId: seat.player.id, token: seat.token, roomId });
      room.broadcastState();
      console.log(`${name} joined room ${roomId}`);
      break;
    }

    case 'reconnect': {
      const roomId = msg.roomId?.toUpperCase();
      const room = rooms.get(roomId);
      if (!room) {
        send(ws, { type: 'error', code: 'ROOM_NOT_FOUND', message: 'Room not found' });
        return;
      }
      const seat = room.reconnect(ws, msg.token);
      if (!seat) {
        send(ws, { type: 'error', code: 'INVALID_TOKEN', message: 'Invalid reconnect token' });
        return;
      }
      wsContext.set(ws, { playerId: seat.player.id, roomId });
      send(ws, { type: 'joined', playerId: seat.player.id, token: seat.token, roomId });
      room.sendState(ws, seat.player.id);
      room.broadcastState();
      console.log(`${seat.player.name} reconnected to room ${roomId}`);
      break;
    }

    case 'startGame': {
      const ctx = wsContext.get(ws);
      if (!ctx) { send(ws, { type: 'error', code: 'NOT_IN_ROOM', message: 'Not in a room' }); return; }
      const room = rooms.get(ctx.roomId);
      if (!room) return;
      const err = room.startGame(ctx.playerId);
      if (err) send(ws, { type: 'error', code: err, message: err });
      break;
    }

    case 'placeBid': {
      const ctx = wsContext.get(ws);
      if (!ctx) return;
      const room = rooms.get(ctx.roomId);
      if (!room) return;
      const err = room.placeBid(ctx.playerId, msg.bid);
      if (err) send(ws, { type: 'error', code: err, message: err });
      break;
    }

    case 'playCard': {
      const ctx = wsContext.get(ws);
      if (!ctx) return;
      const room = rooms.get(ctx.roomId);
      if (!room) return;
      const err = room.playCard(ctx.playerId, msg.cardId);
      if (err) send(ws, { type: 'error', code: err, message: err });
      break;
    }

    case 'restartGame': {
      const ctx = wsContext.get(ws);
      if (!ctx) return;
      const room = rooms.get(ctx.roomId);
      if (!room) return;
      const err = room.restartGame(ctx.playerId);
      if (err) send(ws, { type: 'error', code: err, message: err });
      break;
    }

    default: {
      send(ws, { type: 'error', code: 'UNKNOWN_MESSAGE', message: 'Unknown message type' });
    }
  }
}

httpServer.listen(PORT, () => {
  console.log(`Prediction Card Game relay running on port ${PORT}`);
});
