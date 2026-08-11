// ─── Suits & Cards ───────────────────────────────────────────────────────────

export type Suit = 'D' | 'C' | 'H' | 'S'; // Diamonds, Clubs, Hearts, Spades
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  id: string;   // e.g. "AH", "10D"
  rank: Rank;
  suit: Suit;
}

// ─── Game phases ─────────────────────────────────────────────────────────────

export type GamePhase = 'LOBBY' | 'DEALING' | 'TRUMP_SELECT' | 'BIDDING' | 'PLAYING' | 'ROUND_SCORING' | 'GAME_OVER';

// ─── Game modes ──────────────────────────────────────────────────────────────

export type GameMode = 'classic' | 'upDown' | 'blind' | 'revolvingTrump';

export interface GameModeInfo { id: GameMode; label: string; short: string; desc: string; }

export const GAME_MODES: GameModeInfo[] = [
  { id: 'classic', label: 'Classic',   short: 'Classic',   desc: 'Random trump each round — the original game.' },
  { id: 'upDown',  label: 'Up & Down', short: 'Up & Down', desc: 'Rounds climb 1→7, then back down to 1 (13 rounds).' },
  { id: 'blind',   label: 'Blind Bid', short: 'Blind',     desc: 'Bid before you see your cards.' },
  { id: 'revolvingTrump', label: 'Revolving Trump', short: 'Rev. Trump', desc: 'The first bidder picks the trump each round.' },
];

// ─── Trump options (Revolving Trump mode) ───────────────────────────────────

export type TrumpKind = 'suit' | 'noTrump' | 'highCard' | 'lowCard' | 'ak47' | 'oneTrump' | 'kingQueen';

export interface TrumpConfig {
  kind: TrumpKind;
  suit?: Suit;  // when kind === 'suit'
  rank?: Rank;  // when kind === 'oneTrump' (server picks the rank)
}

// Special (non-suit) options the first bidder can choose, in picker order.
export interface TrumpSpecial { kind: TrumpKind; label: string; }
export const TRUMP_SPECIALS: TrumpSpecial[] = [
  { kind: 'noTrump',   label: 'No Trump' },
  { kind: 'highCard',  label: 'High Card' },
  { kind: 'lowCard',   label: 'Low Card' },
  { kind: 'ak47',      label: 'AK47' },
  { kind: 'oneTrump',  label: 'One Trump' },
  { kind: 'kingQueen', label: 'King-Queen' },
];

// Short label for the trump chip (client maps 'suit' to its symbol + name itself).
export function trumpLabel(cfg: TrumpConfig): string {
  switch (cfg.kind) {
    case 'suit':      return cfg.suit ?? '';
    case 'noTrump':   return 'No Trump';
    case 'highCard':  return 'High Card';
    case 'lowCard':   return 'Low Card';
    case 'ak47':      return 'AK47';
    case 'oneTrump':  return `One Trump (${cfg.rank ?? '?'})`;
    case 'kingQueen': return 'King-Queen';
  }
}

// One-liner rule shown in the trump chip's info (ⓘ) tooltip.
export function trumpInfo(cfg: TrumpConfig): string {
  switch (cfg.kind) {
    case 'suit':      return 'This suit beats every other suit.';
    case 'noTrump':   return 'No trump — the highest card of the led suit wins.';
    case 'highCard':  return 'No trump — the highest card played wins, any suit.';
    case 'lowCard':   return 'No trump — the lowest card played wins, any suit.';
    case 'ak47':      return 'Every A, K, 4 and 7 is a trump.';
    case 'oneTrump':  return `Every ${cfg.rank ?? '?'} is a trump.`;
    case 'kingQueen': return 'Every King and Queen is a trump.';
  }
}

// ─── Player ──────────────────────────────────────────────────────────────────

export interface Player {
  id: string;
  name: string;
  seatIndex: number;
  connected: boolean;               // convenience: connected === (status === 'online')
  status: 'online' | 'reconnecting' | 'offline';
}

// ─── Trick card entry ─────────────────────────────────────────────────────────

export interface TrickCard {
  playerId: string;
  card: Card;
}

// ─── Per-round score row ──────────────────────────────────────────────────────

export interface RoundScore {
  round: number;
  bid: number;
  won: number;
  delta: number;
  total: number;
}

// ─── Scoreboard ──────────────────────────────────────────────────────────────

export type Scoreboard = Record<string, RoundScore[]>; // playerId → rounds

// ─── Redacted game state (sent to each client) ───────────────────────────────

export interface GameState {
  phase: GamePhase;
  roomId: string;
  players: Player[];
  hostId: string;
  maxPlayers: number;
  round: number | null;        // current round number (7..1), null in LOBBY
  trump: Suit | null;
  trumpConfig: TrumpConfig | null; // full trump rule for the round (Revolving Trump specials)
  yourHand: Card[];            // only the recipient's cards
  handCounts: Record<string, number>; // other players' card counts
  bids: Record<string, number | null>; // playerId → bid (null if not yet bid)
  currentTurn: string | null;  // playerId whose turn it is
  currentTrick: TrickCard[];   // cards played in current trick (in order)
  trickLeader: string | null;  // who leads the current trick
  scoreboard: Scoreboard;
  firstBidder: string | null;
  tricksWon: Record<string, number>; // playerId → tricks won this round
  countdownMs: number | null; // ms left on the lobby auto-start countdown (null unless counting down)
  turnTimeoutMs: number; // full turn budget for the current phase (ring denominator)
  turnExpiresAt: number | null; // absolute epoch ms the current turn auto-resolves (null = no live turn / paused)
  turnRemainingMs: number | null; // ms left on the current turn at broadcast (frozen value while paused)
  roomExpiresInMs: number | null; // ms until a finished room auto-closes (null unless in GAME_OVER)
  mode: GameMode; // the room's game mode
}

// ─── WebSocket messages: Client → Server ────────────────────────────────────

export interface MsgCreateRoom {
  type: 'createRoom';
  name: string;
  maxPlayers?: number; // 2–7, defaults to 7
  mode?: GameMode; // defaults to 'classic'
}

export interface MsgJoinRoom {
  type: 'joinRoom';
  roomId: string;
  name: string;
}

export interface MsgReconnect {
  type: 'reconnect';
  roomId: string;
  token: string;
}

export interface MsgStartGame {
  type: 'startGame';
}

export interface MsgPlaceBid {
  type: 'placeBid';
  bid: number;
}

export interface MsgPlayCard {
  type: 'playCard';
  cardId: string;
}

export interface MsgRestartGame {
  type: 'restartGame';
}

export interface MsgLeaveRoom {
  type: 'leaveRoom';
}

export interface MsgQuickMessage {
  type: 'quickMessage';
  id: string; // one of QUICK_MESSAGES[].id
}

export interface MsgSelectTrump {
  type: 'selectTrump';
  kind: TrumpKind;
  suit?: Suit; // required when kind === 'suit'
}

export type ClientMessage =
  | MsgCreateRoom
  | MsgJoinRoom
  | MsgReconnect
  | MsgStartGame
  | MsgPlaceBid
  | MsgPlayCard
  | MsgRestartGame
  | MsgLeaveRoom
  | MsgQuickMessage
  | MsgSelectTrump;

// ─── WebSocket messages: Server → Client ────────────────────────────────────

export interface MsgJoined {
  type: 'joined';
  playerId: string;
  token: string;
  roomId: string;
}

export interface MsgState {
  type: 'state';
  state: GameState;
}

export interface MsgRoundResult {
  type: 'roundResult';
  round: number;
  perPlayer: Array<{
    playerId: string;
    name: string;
    bid: number;
    won: number;
    delta: number;
    total: number;
  }>;
}

export interface MsgGameOver {
  type: 'gameOver';
  winners: string[]; // playerIds
  finalScores: Record<string, number>; // playerId → total
  playerNames: Record<string, string>;
}

export type ErrorCode =
  | 'INVALID_NAME'
  | 'ROOM_NOT_FOUND'
  | 'GAME_STARTED'
  | 'ROOM_FULL'
  | 'JOIN_FAILED'
  | 'INVALID_TOKEN'
  | 'NOT_IN_ROOM'
  | 'BAD_MESSAGE'
  | 'NOT_HOST'
  | 'WRONG_PHASE'
  | 'NOT_ENOUGH_PLAYERS'
  | 'NOT_YOUR_TURN'
  | 'INVALID_BID'
  | 'CARD_NOT_IN_HAND'
  | 'ILLEGAL_CARD'
  | 'INVALID_TRUMP';

export interface MsgError {
  type: 'error';
  code: ErrorCode;
  message: string;
}

export interface MsgRoomClosed {
  type: 'roomClosed'; // the finished room's TTL elapsed; it's being destroyed
}

export interface MsgQuickMessageBroadcast {
  type: 'quickMessage';
  senderId: string;
  text: string;
}

export type ServerMessage =
  | MsgJoined
  | MsgState
  | MsgRoundResult
  | MsgGameOver
  | MsgError
  | MsgRoomClosed
  | MsgQuickMessageBroadcast;

// ─── Quick chat messages (predefined, tap-to-send) ──────────────────────────

export interface QuickMessage { id: string; text: string; }

export const QUICK_MESSAGES: QuickMessage[] = [
  { id: 'play-fast',   text: 'Play Fast' },
  { id: 'nice-move',   text: 'Nice Move' },
  { id: 'my-game',     text: 'My Game' },
  { id: 'better-luck', text: 'Better Luck Next Time' },
  { id: 'good-game',   text: 'Good Game' },
  { id: 'hurry-up',    text: 'Hurry Up!' },
  { id: 'oh-shit',     text: 'Oh Shit!' },
  { id: 'thinking',    text: 'Thinking' },
  { id: 'thank-you',   text: 'Thank You' },
  { id: 'close-one',   text: 'Close One!' }
];
