import { ErrorCode } from 'shared';

// Server-only constants (the client never reads these).
//   1. Timers & limits — abuse protection + gameplay pacing. All *_MS are milliseconds.
//   2. Error messages — friendly text per ErrorCode (the server sends these to clients).

// ─── 1. Timers & limits ──────────────────────────────────────────────────────
export const MAX_PAYLOAD_BYTES = 8192;        // inbound WebSocket message cap (messages are tiny)
export const MAX_CONN_PER_IP = 30;            // concurrent connections per IP
export const RATE_LIMIT_PER_SEC = 25;         // messages / second / connection
export const BID_TIMEOUT_MS = 30_000;         // time to bid before an auto-bid of 0
export const PLAY_TIMEOUT_MS = 30_000;        // time to play before an auto-play of a legal card
export const RECONNECT_WINDOW_MS = 60_000;    // grace period for a disconnected player to return
export const EMPTY_ROOM_DESTROY_MS = 120_000; // keep an empty room this long before destroying it
export const GAME_OVER_TTL_MS = 15_000;       // keep a finished room this long before it auto-closes (rematch cancels it)
export const COUNTDOWN_MS = 5_000;            // lobby auto-start countdown once the room is full
export const DISCONNECTED_AUTO_MOVE_MS = 500; // auto-move delay for a disconnected player's seat
export const TRICK_DISPLAY_MS = 1_500;        // how long a completed trick is shown
export const ROUND_END_DELAY_MS = 3_000;      // pause after round scoring before the next round

// ─── 2. Error messages ───────────────────────────────────────────────────────
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  INVALID_NAME: 'Please enter a valid name.',
  ROOM_NOT_FOUND: 'That room has expired or no longer exists.',
  GAME_STARTED: 'That game has already started.',
  ROOM_FULL: 'Room is full (max 7 players).',
  JOIN_FAILED: 'Could not join the room. Please try again.',
  INVALID_TOKEN: 'Your session expired. Please rejoin.',
  NOT_IN_ROOM: 'You are not in a room.',
  BAD_MESSAGE: 'Something went wrong. Please try again.',
  NOT_HOST: 'Only the host can do that.',
  WRONG_PHASE: "You can't do that right now.",
  NOT_ENOUGH_PLAYERS: 'Need at least 2 players to start.',
  NOT_YOUR_TURN: "It's not your turn.",
  INVALID_BID: 'That bid is not allowed.',
  CARD_NOT_IN_HAND: "You don't have that card.",
  ILLEGAL_CARD: 'You must follow the lead suit if you can.',
};
