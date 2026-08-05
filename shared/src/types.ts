// ─── Suits & Cards ───────────────────────────────────────────────────────────

export type Suit = 'D' | 'C' | 'H' | 'S'; // Diamonds, Clubs, Hearts, Spades
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  id: string;   // e.g. "AH", "10D"
  rank: Rank;
  suit: Suit;
}

// ─── Game phases ─────────────────────────────────────────────────────────────

export type GamePhase = 'LOBBY' | 'DEALING' | 'BIDDING' | 'PLAYING' | 'ROUND_SCORING' | 'GAME_OVER';

// ─── Player ──────────────────────────────────────────────────────────────────

export interface Player {
  id: string;
  name: string;
  seatIndex: number;
  connected: boolean;
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
}

// ─── WebSocket messages: Client → Server ────────────────────────────────────

export interface MsgCreateRoom {
  type: 'createRoom';
  name: string;
  maxPlayers?: number; // 2–7, defaults to 7
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

export type ClientMessage =
  | MsgCreateRoom
  | MsgJoinRoom
  | MsgReconnect
  | MsgStartGame
  | MsgPlaceBid
  | MsgPlayCard
  | MsgRestartGame
  | MsgLeaveRoom;

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

export interface MsgError {
  type: 'error';
  code: string;
  message: string;
}

export type ServerMessage =
  | MsgJoined
  | MsgState
  | MsgRoundResult
  | MsgGameOver
  | MsgError;
