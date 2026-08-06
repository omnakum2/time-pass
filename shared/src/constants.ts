// Shared game constants, card data, and error codes (single source of truth for both tiers).
//   1. Game constants — round/player/name limits used by the rules engine.
//   2. Card data — ranks, suits, and display maps.
//   3. Error messages — friendly text per ErrorCode (server sends these to clients).

import { Suit, Rank, ErrorCode } from './types';

// ─── 1. Game constants ───────────────────────────────────────────────────────
export const START_ROUND = 7;
export const TOTAL_ROUNDS = 7;
export const ROUNDS: number[] = [7, 6, 5, 4, 3, 2, 1];
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 7;
export const NAME_MIN_LEN = 2;
export const NAME_MAX_LEN = 20;

// ─── 2. Card data ────────────────────────────────────────────────────────────
export const RANK_ORDER: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const SUITS: Suit[] = ['D', 'C', 'H', 'S'];
export const SUIT_ORDER: Suit[] = ['S', 'H', 'D', 'C'];
export const RED_SUITS: ReadonlySet<Suit> = new Set<Suit>(['D', 'H']);
export const SUIT_SYMBOL: Record<Suit, string> = { D: '♦', C: '♣', H: '♥', S: '♠' };
export const SUIT_NAME: Record<Suit, string> = { D: 'Diamonds', C: 'Clubs', H: 'Hearts', S: 'Spades' };
export function isRedSuit(s: Suit): boolean { return RED_SUITS.has(s); }

// ─── 3. Error messages ───────────────────────────────────────────────────────
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
