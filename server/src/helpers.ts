import { WebSocket } from 'ws';
import { randomInt } from 'crypto';
import {
  ServerMessage, ClientMessage, ErrorCode,
  MIN_PLAYERS, MAX_PLAYERS, NAME_MAX_LEN,
} from 'shared';
import { ERROR_MESSAGES } from './constants';

// ─── Messaging ───────────────────────────────────────────────────────────────

/** Serialize and send one message; never throws on a dead/closed socket. */
export function sendMessage(ws: WebSocket, msg: ServerMessage): void {
  try { ws.send(JSON.stringify(msg)); } catch { /* socket closed — ignore */ }
}

/** Send a typed error with its server-owned friendly message. */
export function sendError(ws: WebSocket, code: ErrorCode): void {
  sendMessage(ws, { type: 'error', code, message: ERROR_MESSAGES[code] });
}

// ─── Input sanitizing ────────────────────────────────────────────────────────

/** Trim a player name and cap it to the shared max length. */
export function sanitizeName(name: string): string {
  return name.trim().slice(0, NAME_MAX_LEN);
}

/** Clamp a requested player count into [MIN_PLAYERS, MAX_PLAYERS]. */
export function clampPlayers(n: number): number {
  return Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, Math.floor(n)));
}

// ─── Room codes ──────────────────────────────────────────────────────────────

const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous 0/O/1/I
/** A random 6-char uppercase room code (crypto-random, non-enumerable). */
export function randomRoomCode(): string {
  let id = '';
  for (let i = 0; i < 6; i++) id += ROOM_CODE_CHARS[randomInt(ROOM_CODE_CHARS.length)];
  return id;
}

// ─── Edge validation ─────────────────────────────────────────────────────────

/**
 * Validate an inbound client message's payload *shape* at the edge.
 * Returns an ErrorCode if the payload is malformed, or null if it is well-formed.
 * Business rules (turn order, phase, bid range) stay in the Room.
 */
export function validateMessage(msg: ClientMessage): ErrorCode | null {
  switch (msg.type) {
    case 'createRoom':
      return typeof msg.name === 'string'
        && (msg.game === undefined || typeof msg.game === 'string')
        ? null : 'INVALID_NAME';
    case 'joinRoom':
      return typeof msg.name === 'string' && typeof msg.roomId === 'string' ? null : 'INVALID_NAME';
    case 'reconnect':
      return typeof msg.roomId === 'string' && typeof msg.token === 'string' ? null : 'INVALID_TOKEN';
    case 'placeBid':
      return Number.isInteger(msg.bid) ? null : 'INVALID_BID';
    case 'playCard':
      return typeof msg.cardId === 'string' ? null : 'BAD_MESSAGE';
    case 'selectTrump':
      return typeof msg.kind === 'string' ? null : 'INVALID_TRUMP';
    case 'pushBid':
      return typeof msg.push === 'boolean' ? null : 'BAD_MESSAGE';
    case 'quickMessage':
      return typeof msg.id === 'string' ? null : 'BAD_MESSAGE';
    case 'updateRoomSettings':
      return (msg.maxPlayers === undefined || typeof msg.maxPlayers === 'number')
        && (msg.mode === undefined || typeof msg.mode === 'string')
        ? null : 'INVALID_SETTINGS';
    case 'thosoDraw':
      return null;
    case 'thosoTransfer':
      return typeof msg.cardId === 'string' && typeof msg.toPlayerId === 'string' ? null : 'BAD_MESSAGE';
    case 'thosoPlay':
      return typeof msg.cardId === 'string' ? null : 'BAD_MESSAGE';
    case 'startGame':
    case 'restartGame':
    case 'leaveRoom':
      return null;
    default:
      return 'BAD_MESSAGE';
  }
}
