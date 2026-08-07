// Shared domain constants used by both tiers (single source of truth).
//   1. Game constants — round/player/name limits used by the rules engine.
//   2. Card data — ranks, suits, and display maps.

import { Suit, Rank } from './types';

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
