// ─── Suits & Cards ───────────────────────────────────────────────────────────

export type Suit = 'D' | 'C' | 'H' | 'S'; // Diamonds, Clubs, Hearts, Spades
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  id: string;   // e.g. "AH", "10D"
  rank: Rank;
  suit: Suit;
}

// ─── Game phases ─────────────────────────────────────────────────────────────

export type GamePhase = 'LOBBY' | 'DEALING' | 'TRUMP_SELECT' | 'BIDDING' | 'PUSH' | 'PLAYING' | 'ROUND_SCORING' | 'GAME_OVER';

// ─── Round announcement banner (mode intros + Up & Down milestones) ──────────

export interface Announcement {
  title: string;
  subtitle?: string;
  multiplier?: number; // shown as ×N (stakes change / Summit / Last Stand); absent for mode intros
  icon?: 'crown' | 'swords' | 'trendingUp' | 'trendingDown'; // client Icon key (intros show no icon)
  variant: 'intro' | 'stakesUp' | 'stakesDown' | 'summit' | 'lastStand';
}

// ─── Game modes ──────────────────────────────────────────────────────────────

export type GameMode = 'classic' | 'upDown' | 'blind' | 'revolvingTrump';

export interface GameModeInfo { id: GameMode; label: string; short: string; desc: string; }

export const GAME_MODES: GameModeInfo[] = [
  { id: 'classic', label: 'Classic',   short: 'Classic',   desc: 'The original game, with a random trump each round.' },
  { id: 'upDown',  label: 'Up & Down', short: 'Up & Down', desc: 'Climb 1→7→1 with rising stakes, a ×3 Summit, and a ×10 Last Stand.' },
  { id: 'blind',   label: 'Blind Bid', short: 'Blind',     desc: 'Bid blind, then lock (×2) or push (×3).' },
  { id: 'revolvingTrump', label: 'Revolving Trump', short: 'Rev. Trump', desc: 'The first bidder picks the trump each round.' },
];

/**
 * Whether a player's own hand must stay hidden right now. Blind Bid mode hides the
 * hand while dealing and bidding, revealing it only once play begins. Single source
 * of truth for both the server (sends an empty hand) and the client (renders backs).
 */
export function isHandHiddenForBid(mode: GameMode, phase: GamePhase): boolean {
  return mode === 'blind' && (phase === 'BIDDING' || phase === 'DEALING');
}

// ─── Trump options (Revolving Trump mode) ───────────────────────────────────

export type TrumpKind = 'suit' | 'noTrump' | 'lowCard' | 'ak47' | 'oneTrump' | 'kingQueen';

export interface TrumpConfig {
  kind: TrumpKind;
  suit?: Suit;  // when kind === 'suit'
  rank?: Rank;  // when kind === 'oneTrump' (server picks the rank)
}

// Special (non-suit) options the first bidder can choose, in picker order.
export interface TrumpSpecial { kind: TrumpKind; label: string; }
export const TRUMP_SPECIALS: TrumpSpecial[] = [
  { kind: 'noTrump',   label: 'No Trump' },
  { kind: 'lowCard',   label: 'Low Card' },
  { kind: 'ak47',      label: 'AK47' },
  { kind: 'oneTrump',  label: 'One Trump' },
  { kind: 'kingQueen', label: 'King-Queen' },
];

// Short label for the trump chip (client maps 'suit' to its symbol + name itself).
// Static special labels come from TRUMP_SPECIALS (single source of truth); only
// 'suit' and 'oneTrump' (which annotates the picked rank) need special handling.
export function trumpLabel(cfg: TrumpConfig): string {
  if (cfg.kind === 'suit') return cfg.suit ?? '';
  if (cfg.kind === 'oneTrump') return `One Trump (${cfg.rank ?? '?'})`;
  return TRUMP_SPECIALS.find(s => s.kind === cfg.kind)?.label ?? '';
}

// One-liner rule shown in the trump chip's info (ⓘ) tooltip.
export function trumpInfo(cfg: TrumpConfig): string {
  switch (cfg.kind) {
    case 'suit':      return 'This suit beats every other suit.';
    case 'noTrump':   return 'No trump: the highest card of the led suit wins.';
    case 'lowCard':   return 'No trump: the lowest card of the led suit wins.';
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
  status: 'online' | 'reconnecting' | 'offline'; // 'online' = live socket; 'reconnecting' = in grace window; 'offline' = gone
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
  multiplier: number; // score multiplier applied this round for this player (Up & Down tier, or Blind lock ×2 / push ×3)
}

// ─── Scoreboard ──────────────────────────────────────────────────────────────

export type Scoreboard = Record<string, RoundScore[]>; // playerId → rounds

// ─── Common room-lifecycle state shared by every game's redacted state ───────

/** Common room-lifecycle state shared by every game's redacted state */
export interface BaseRoomState {
  phase: string;                     // each game narrows this to its own phase union
  roomId: string;
  players: Player[];
  hostId: string;
  maxPlayers: number;
  currentTurn: string | null;
  countdownMs: number | null;        // lobby auto-start countdown (null unless counting down)
  turnTimeoutMs: number;             // full turn budget (ring denominator)
  turnExpiresAt: number | null;      // absolute epoch ms the current turn auto-resolves
  turnRemainingMs: number | null;    // ms left on the current turn at broadcast
  roomExpiresInMs: number | null;    // ms until a finished room auto-closes
  announcement: Announcement | null;
}

// ─── Redacted game state (sent to each client) ───────────────────────────────

export interface BidBaaziState extends BaseRoomState {
  game: 'bidbaazi';                // registry game id (mirrors ThosoState.game) — lets one state channel self-identify
  phase: GamePhase;                // narrows BaseRoomState.phase
  round: number | null;        // current round number (7..1), null in LOBBY
  trump: Suit | null;
  trumpConfig: TrumpConfig | null; // full trump rule for the round (Revolving Trump specials)
  yourHand: Card[];            // only the recipient's cards
  handCounts: Record<string, number>; // other players' card counts
  bids: Record<string, number | null>; // playerId → bid (null if not yet bid)
  currentTrick: TrickCard[];   // cards played in current trick (in order)
  trickLeader: string | null;  // who leads the current trick
  scoreboard: Scoreboard;
  firstBidder: string | null;
  tricksWon: Record<string, number>; // playerId → tricks won this round
  mode: GameMode; // the room's game mode
  pushStatus: Record<string, 'locked' | 'pushed'> | null; // Blind Bid PUSH phase: each decided player's choice (null otherwise)
}

// ─── Redacted Thoso state (sent to each client) ──────────────────────────────

export interface ThosoState extends BaseRoomState {
  game: 'thoso';
  phase: 'LOBBY' | 'TRANSFER' | 'PLAYING' | 'GAME_OVER'; // narrows BaseRoomState.phase
  drawPileCount: number;                 // cards left in the central draw pile (Phase 1)
  pileTops: Record<string, Card | null>; // Phase 1: every player's face-up pile TOP card (public)
  drawnCard: Card | null;                // Phase 1: current player's just-drawn face-up card awaiting a transfer decision (public; null when none pending)
  penaltyReveal: Card[] | null;          // Phase 1: the cards THIS player just received as a missed-transfer penalty (private, shown ~5s); null otherwise
  handCounts: Record<string, number>;    // Phase 2: per-player hand size (not incl. your own detail)
  yourHand: Card[];                       // Phase 2: your own full hand (empty in Phase 1 — only your top card is visible, via pileTops)
  ledSuit: Suit | null;                   // Phase 2: current round's led suit
  mustLeadAceOfSpades: boolean;           // Phase 2: true during the opening lead, until the Ace of Spades has been played
  currentTrick: TrickCard[];              // Phase 2: cards played so far this round
  roundResolving: boolean;                // true while a completed Phase-2 round is held on screen before clearing
  finishedRanks: { playerId: string; rank: number }[]; // finishing order (1 = first out)
}

// ─── WebSocket messages: Client → Server ────────────────────────────────────

export interface MsgCreateRoom {
  type: 'createRoom';
  name: string;
  game?: string; // registry game id (e.g. 'bidbaazi'); defaults to 'bidbaazi'
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

export interface MsgPushBid {
  type: 'pushBid';
  push: boolean; // true = raise blind bid by 1 (×3), false = lock it (×2)
}

export interface MsgUpdateRoomSettings {
  type: 'updateRoomSettings';
  maxPlayers?: number; // 2–7; server clamps and blocks below seated count
  mode?: GameMode;
}

// ─── Thoso client messages ──────────────────────────────────────────────────

export interface MsgThosoDraw {
  type: 'thosoDraw'; // draw one card from the central pile (Phase 1)
}

export interface MsgThosoTransfer {
  type: 'thosoTransfer';
  cardId: string;       // card from own pile or the just-drawn card
  toPlayerId: string;   // eligible recipient (Phase 1)
}

export interface MsgThosoPlay {
  type: 'thosoPlay';
  cardId: string; // Phase 2; the server decides whether it's a follow or a Thoso
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
  | MsgSelectTrump
  | MsgPushBid
  | MsgUpdateRoomSettings
  | MsgThosoDraw
  | MsgThosoTransfer
  | MsgThosoPlay;

// ─── WebSocket messages: Server → Client ────────────────────────────────────

export interface MsgJoined {
  type: 'joined';
  playerId: string;
  token: string;
  roomId: string;
}

export interface MsgState {
  type: 'state';
  state: BidBaaziState | ThosoState; // one state channel for every game — the client routes by state.game
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
  | 'INVALID_TRUMP'
  | 'INVALID_SETTINGS';

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

export interface QuickMessage { id: string; text: string; tab: 'default' | 'meme'; }

export const QUICK_MESSAGES: QuickMessage[] = [
  { id: 'play-fast',   text: 'Play Fast',       tab: 'default' },
  { id: 'nice-move',   text: 'Nice Move',       tab: 'default' },
  { id: 'my-game',     text: 'My Game',         tab: 'default' },
  { id: 'better-luck', text: 'Better Luck',     tab: 'default' },
  { id: 'good-game',   text: 'Good Game',       tab: 'default' },
  { id: 'hurry-up',    text: 'Hurry Up!',       tab: 'default' },
  { id: 'oh-shit',     text: 'Oh Shit!',        tab: 'default' },
  { id: 'thinking',    text: 'Thinking',        tab: 'default' },
  { id: 'thank-you',   text: 'Thank You',       tab: 'default' },
  { id: 'close-one',   text: 'Close One!',      tab: 'default' },
  { id: 'm-jaldi',     text: 'Jaldi jaldi',     tab: 'meme' },
  { id: 'm-masti',     text: 'Masti nahi.',     tab: 'meme' },
  { id: 'm-sahi',      text: 'Sahi baat hai.',  tab: 'meme' },
  { id: 'm-shanti',    text: 'Shanti rakho!',   tab: 'meme' },
  { id: 'm-mataji',    text: 'Hey Maa Mataji!', tab: 'meme' },
  { id: 'm-babuchak',  text: 'A Babuchak.',     tab: 'meme' },
  { id: 'm-sabass',    text: 'Sabass jethiya.', tab: 'meme' },
  { id: 'm-band',      text: 'Aye, band kar!',  tab: 'meme' },
  { id: 'm-kya',       text: 'Kya karu?',       tab: 'meme' },
  { id: 'm-jethalal',  text: 'Ae Pagal Aurat!', tab: 'meme' }
];
