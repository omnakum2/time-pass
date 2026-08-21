import type { DailyReward } from './dailyLogin';
import type { SpinPrize } from './spinWheel';

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

export type GameMode = 'classic' | 'upDown' | 'blind' | 'revolvingTrump' | 'coinRush';

export interface GameModeInfo { id: GameMode; label: string; short: string; desc: string; }

export const GAME_MODES: GameModeInfo[] = [
  { id: 'classic', label: 'Classic',   short: 'Classic',   desc: 'The original game, with a random trump each round.' },
  { id: 'upDown',  label: 'Up & Down', short: 'Up & Down', desc: 'Climb 1→7→1 with rising stakes, a ×3 Summit, and a ×10 Last Stand.' },
  { id: 'blind',   label: 'Blind Bid', short: 'Blind',     desc: 'Bid blind, then lock (×2) or push (×3).' },
  { id: 'revolvingTrump', label: 'Revolving Trump', short: 'Rev. Trump', desc: 'The first bidder picks the trump each round.' },
  { id: 'coinRush', label: 'Coin Rush', short: 'Coin Rush', desc: 'Real-Coin buy-in; win chips + a growing Jackpot, then cash out by rank.' },
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

// ─── User account (V3: trusted identity + wallet) ────────────────────────────

export interface UserAccount {
  uid: string;
  displayName: string;
  coins: number;
  gems: number;
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

// ─── Coin Rush (currency mode) state ─────────────────────────────────────────

// Live currency-mode block, mirrored to clients (null for the other 4 modes).
// All coin figures are Gold Coins; `chips`/`jackpot` are in-memory points.
export interface CurrencyState {
  betAmount: number;                 // host-set coin buy-in per seat
  fee: number;                       // per-seat coin fee (burned; the sink)
  pool: number;                      // prize pool = sum of betAmounts (fee excluded)
  startingChips: number;             // each seat's opening chip stack
  chips: Record<string, number>;     // playerId → current chip stack
  jackpot: number;                   // current jackpot (chips), fills on misses
  eliminated: string[];              // playerIds in bust order, earliest first
}

// Per-player final result, sent in the game-over settlement.
export interface SettlementEntry {
  chips: number;    // final chip stack (chips-at-bust for eliminated players)
  coinsWon: number; // coins paid from the pool (0 if out of the money / forfeited)
  firstWinBonus?: number; // V3 Phase 6: first-Coin-Rush-win-of-the-day bonus (also credited; included in net)
  net: number;      // (coinsWon + firstWinBonus) − (betAmount + fee): net Coin change for the game
}

// Final ranked settlement for a coinRush game.
export interface Settlement {
  rank: string[];                            // playerIds, 1st → last (ties broken deterministically)
  payouts: Record<string, SettlementEntry>;  // by playerId
}

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
  announcement: Announcement | null; // banner to show during the DEALING window (mode intro / Up & Down milestone)
  pushStatus: Record<string, 'locked' | 'pushed'> | null; // Blind Bid PUSH phase: each decided player's choice (null otherwise)
  currency: CurrencyState | null; // Coin Rush live economy (chips/pot/jackpot/eliminated); null for the other 4 modes
}

// ─── WebSocket messages: Client → Server ────────────────────────────────────

export interface MsgCreateRoom {
  type: 'createRoom';
  name: string;
  maxPlayers?: number; // 2–7, defaults to 7
  mode?: GameMode; // defaults to 'classic'
  idToken?: string; // V3: trusted identity token (dev or Firebase); absent = anonymous
  betAmount?: number;     // coinRush only: host coin buy-in (≥100, multiple of 10); ignored otherwise
  startingChips?: number; // coinRush only: starting chip stack (one of STARTING_CHIP_PRESETS)
}

export interface MsgJoinRoom {
  type: 'joinRoom';
  roomId: string;
  name: string;
  idToken?: string; // V3: trusted identity token (dev or Firebase); absent = anonymous
}

export interface MsgReconnect {
  type: 'reconnect';
  roomId: string;
  token: string;
  idToken?: string; // V3: trusted identity token (dev or Firebase); absent = anonymous
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
  betAmount?: number;     // coinRush only: host coin buy-in (≥100, multiple of 10)
  startingChips?: number; // coinRush only: starting chip stack (one of STARTING_CHIP_PRESETS)
}

// ─── Reward protocol (V3: daily login + spin wheel) ─────────────────────────
// Each carries an optional idToken (same pattern as MsgCreateRoom); the server
// resolves the account from it, so an unauthenticated caller gets NOT_AUTHENTICATED.

export interface MsgGetRewards {
  type: 'getRewards';
  idToken?: string;
}

export interface MsgClaimDaily {
  type: 'claimDaily';
  idToken?: string;
}

export interface MsgSpin {
  type: 'spin';
  idToken?: string;
}

// V3 Phase 5: convert Gems → Coins (one-way; 1 Gem = GEM_TO_COINS Coins).
export interface MsgConvertGems {
  type: 'convertGems';
  gems: number; // whole number of Gems to convert (≥1, ≤ held)
  idToken?: string;
}

// V3 Phase 5: request the current weekly leaderboard.
export interface MsgGetLeaderboard {
  type: 'getLeaderboard';
  idToken?: string;
}

// V3 Phase 6: fetch the player's own referral code + invite count.
export interface MsgGetReferral {
  type: 'getReferral';
  idToken?: string;
}

// V3 Phase 6: apply someone else's referral code (one-time; both sides rewarded).
export interface MsgApplyReferral {
  type: 'applyReferral';
  code: string;
  idToken?: string;
}

// V3 Phase 6: claim a rewarded-ad top-up (server-authoritative, daily-capped, ad-SDK-gated).
export interface MsgAdReward {
  type: 'adReward';
  idToken?: string;
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
  | MsgGetRewards
  | MsgClaimDaily
  | MsgSpin
  | MsgConvertGems
  | MsgGetLeaderboard
  | MsgGetReferral
  | MsgApplyReferral
  | MsgAdReward;

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
  settlement?: Settlement; // coinRush only: final ranks + real-Coin payouts
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
  | 'INVALID_SETTINGS'
  | 'AUTH_FAILED'
  | 'NOT_AUTHENTICATED'
  | 'NO_SPINS_LEFT'
  | 'INSUFFICIENT_COINS'
  | 'INSUFFICIENT_BALANCE'
  | 'INSUFFICIENT_GEMS'
  | 'INVALID_AMOUNT'
  | 'INVALID_REFERRAL'
  | 'ALREADY_REFERRED'
  | 'SELF_REFERRAL'
  | 'AD_REWARD_LIMIT'
  | 'AD_REWARD_DISABLED';

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

// V3: sent right after 'joined' when the socket authenticated with an idToken.
export interface MsgAccount {
  type: 'account';
  account: UserAccount;
}

// ─── Reward protocol (V3: server → client) ──────────────────────────────────

export interface MsgRewardsStatus {
  type: 'rewardsStatus';
  canClaimDaily: boolean;
  streak: number;
  spinsUsedToday: number;
  nextSpinCost: number | null;
}

export interface MsgDailyReward {
  type: 'dailyReward';
  claimed: boolean;
  streak: number;
  reward: DailyReward;
  streakBonus: number; // V3 Phase 6: extra Coins from the Coin Rush win-streak (0 if none); already in `account`
  account: UserAccount;
}

export interface MsgSpinResult {
  type: 'spinResult';
  prize: SpinPrize;
  segmentIndex: number;
  cost: number;
  usedToday: number;
  nextCost: number | null;
  account: UserAccount;
}

// V3 Phase 5: one row of the weekly leaderboard (no uid exposed to clients).
export interface LeaderboardEntry {
  rank: number;        // 1-based finishing position on the board
  displayName: string;
  wins: number;        // wins this ISO week
  coins: number;       // coin balance (the tiebreak; also shown)
  isYou: boolean;      // true for the requesting player's own row
}

// V3 Phase 5: the weekly leaderboard, top LEADERBOARD_SIZE by wins then coins.
export interface MsgLeaderboard {
  type: 'leaderboard';
  week: string;                  // IST ISO-week key, e.g. '2026-W34'
  entries: LeaderboardEntry[];   // ranked top → down
  you: LeaderboardEntry | null;  // the requester's own row (even if outside the top N); null if no wins this week
}

// V3 Phase 6: the player's referral standing (own code + invites + whether they can still apply one).
export interface MsgReferralStatus {
  type: 'referralStatus';
  code: string;          // the player's own shareable code
  invitedCount: number;  // how many players have used this code
  referredBy: boolean;   // true once the player has applied someone else's code (can't apply another)
}

export type ServerMessage =
  | MsgJoined
  | MsgState
  | MsgRoundResult
  | MsgGameOver
  | MsgError
  | MsgRoomClosed
  | MsgQuickMessageBroadcast
  | MsgAccount
  | MsgRewardsStatus
  | MsgDailyReward
  | MsgSpinResult
  | MsgLeaderboard
  | MsgReferralStatus;

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
