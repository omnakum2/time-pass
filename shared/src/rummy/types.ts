import { Card, Player } from '../types';

// ─── Cards ───────────────────────────────────────────────────────────────────

// A double-deck (4-6 players) needs two distinguishable physical copies of every
// rank+suit; `copy` + a suffixed `id` keep them unique. A single-deck (2-3 players)
// hand is just `createDeck()` reused as-is, tagged `copy: 1`.
export interface RummyCard extends Card {
  copy: 1 | 2;
}

export type DeckMode = 'single' | 'double'; // single = 52 cards (2-3 players), double = 104 cards (4-6 players)

// ─── Melds ───────────────────────────────────────────────────────────────────

export type MeldKind = 'pure4' | 'pure3' | 'impure3' | 'set3';
export const MELD_KINDS: MeldKind[] = ['pure4', 'pure3', 'impure3', 'set3'];
export const MELD_SIZE: Record<MeldKind, number> = { pure4: 4, pure3: 3, impure3: 3, set3: 3 };

// Card ids assigned into each of the 4 required melds.
export type RummyGroups = Record<MeldKind, string[]>;

// ─── Game phases ─────────────────────────────────────────────────────────────

export type RummyPhase = 'LOBBY' | 'PLAYING' | 'GAME_OVER';

// ─── Redacted game state (sent to each client) ────────────────────────────────

export interface RummyGameState {
  phase: RummyPhase;
  roomId: string;
  players: Player[];
  hostId: string;
  maxPlayers: number;
  deckMode: DeckMode;
  trumpCard: RummyCard | null;
  yourHand: RummyCard[];
  handCounts: Record<string, number>; // other players' card counts
  drawPileCount: number;
  discardTop: RummyCard | null;
  currentTurn: string | null;
  hasDrawnThisTurn: boolean; // true once the current-turn player has drawn (14 cards, must discard/declare next)
  justDrawnCardId: string | null; // set only in the state sent to the current-turn player, if they drew from the discard pile (can't immediately re-discard it)
  ranks: Record<string, number | null>; // playerId -> declare order (1 = winner), null = still playing
  countdownMs: number | null;
  turnTimeoutMs: number;
  turnExpiresAt: number | null;
  turnRemainingMs: number | null;
  roomExpiresInMs: number | null;
}

// ─── WebSocket messages: Client → Server ────────────────────────────────────

export interface MsgDrawCard {
  type: 'drawCard';
  source: 'pile' | 'discard';
}

export interface MsgDiscardCard {
  type: 'discardCard';
  cardId: string;
}

export interface MsgDeclare {
  type: 'declare';
  cardIdToDiscard: string; // the 14th card to set aside; the remaining 13 must satisfy `groups`
  groups: RummyGroups;
}

export type RummyClientMessage = MsgDrawCard | MsgDiscardCard | MsgDeclare;

// ─── WebSocket messages: Server → Client ────────────────────────────────────

export interface MsgRummyState {
  type: 'rummyState';
  state: RummyGameState;
}

export interface MsgRummyGameOver {
  type: 'rummyGameOver';
  ranks: Record<string, number>; // playerId -> final rank (1 = winner)
  playerNames: Record<string, string>;
}

export type RummyServerMessage = MsgRummyState | MsgRummyGameOver;
