import { Card } from '../types';
import { createDeck, shuffle, rankValue } from '../engine';
import { DeckMode, MeldKind, MELD_KINDS, MELD_SIZE, RummyCard, RummyGroups } from './types';

// ─── Deck ────────────────────────────────────────────────────────────────────

// 2-3 players play a single 52-card deck; 4-6 players play the full 104-card
// (2x52) deck. Both use the same 13-card hand / 4-meld declare structure —
// only the deck size (and, downstream, the wildcard mechanic) changes.
export function deckModeFor(playerCount: number): DeckMode {
  return playerCount <= 3 ? 'single' : 'double';
}

function tagDeck(cards: Card[], copy: 1 | 2, suffixId: boolean): RummyCard[] {
  return cards.map(c => ({ ...c, copy, id: suffixId ? `${c.id}_${copy}` : c.id }));
}

export function createRummyDeck(mode: DeckMode): RummyCard[] {
  if (mode === 'single') return tagDeck(createDeck(), 1, false);
  return [...tagDeck(createDeck(), 1, true), ...tagDeck(createDeck(), 2, true)];
}

// ─── Dealing ─────────────────────────────────────────────────────────────────

/**
 * Shuffles a fresh deck, sets aside 1 card as the Trump card (never dealt), deals
 * 13 cards to each player, and returns the remainder as the draw pile.
 */
export function dealRummy(playerCount: number): {
  hands: RummyCard[][];
  trumpCard: RummyCard;
  drawPile: RummyCard[];
  deckMode: DeckMode;
} {
  const deckMode = deckModeFor(playerCount);
  const deck = shuffle(createRummyDeck(deckMode));
  const trumpCard = deck.pop()!;
  const hands: RummyCard[][] = [];
  for (let i = 0; i < playerCount; i++) {
    hands.push(deck.splice(0, 13));
  }
  return { hands, trumpCard, drawPile: deck, deckMode };
}

// ─── Trump wildcard ──────────────────────────────────────────────────────────

/**
 * The Trump's RANK is the joker: any card of that rank, any suit, is a wildcard —
 * in both single- and double-deck games (`deckMode` no longer narrows this to an
 * exact suit match in double-deck play).
 */
export function isWildcard(card: RummyCard, trumpCard: RummyCard, _deckMode: DeckMode): boolean {
  return card.rank === trumpCard.rank;
}

// ─── Meld validation ─────────────────────────────────────────────────────────

function validateSet(naturals: RummyCard[], wildCount: number): boolean {
  const rank = naturals[0].rank;
  if (!naturals.every(c => c.rank === rank)) return false;
  const suits = new Set(naturals.map(c => c.suit));
  if (suits.size !== naturals.length) return false; // suits must be pairwise distinct
  return naturals.length + wildCount === 3;
}

function spanFits(values: number[], wildCount: number, size: number): boolean {
  const sorted = [...values].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1]) return false; // no duplicate rank within one sequence
  }
  const span = sorted[sorted.length - 1] - sorted[0] + 1;
  const internalGaps = span - sorted.length;
  return span <= size && internalGaps <= wildCount;
}

function validateSequence(naturals: RummyCard[], wildCount: number, size: number, sameSuitRequired: boolean): boolean {
  if (naturals.length + wildCount !== size) return false;
  if (sameSuitRequired) {
    const suit = naturals[0].suit;
    if (!naturals.every(c => c.suit === suit)) return false;
  }

  const highAceValues = naturals.map(c => rankValue(c.rank));
  if (spanFits(highAceValues, wildCount, size)) return true;

  // Ace can also anchor the low end of a run (A-2-3…) instead of only the high
  // end (…Q-K-A) — retry valuing it just below the 2. A single meld can only
  // use one interpretation at a time, so this never lets a run bridge both
  // ends (e.g. K-A-2 stays invalid either way).
  if (naturals.some(c => c.rank === 'A')) {
    const lowAceValues = naturals.map(c => (c.rank === 'A' ? -1 : rankValue(c.rank)));
    if (spanFits(lowAceValues, wildCount, size)) return true;
  }

  return false;
}

/** Validates one meld (exact card count for `kind`, at most one wildcard substitution). */
export function validateMeld(cards: RummyCard[], kind: MeldKind, trumpCard: RummyCard, deckMode: DeckMode): boolean {
  if (cards.length !== MELD_SIZE[kind]) return false;
  if (new Set(cards.map(c => c.id)).size !== cards.length) return false;

  const wilds = cards.filter(c => isWildcard(c, trumpCard, deckMode));
  const naturals = cards.filter(c => !isWildcard(c, trumpCard, deckMode));
  if (wilds.length > 1) return false; // a meld only ever needs/accepts one substitution

  if (kind === 'set3') return validateSet(naturals, wilds.length);
  return validateSequence(naturals, wilds.length, MELD_SIZE[kind], kind !== 'impure3');
}

/** Validates a full declare: all 13 hand cards used exactly once, across 4 valid melds. */
export function validateDeclare(hand: RummyCard[], groups: RummyGroups, trumpCard: RummyCard, deckMode: DeckMode): boolean {
  const allIds = MELD_KINDS.flatMap(k => groups[k]);
  if (allIds.length !== 13 || new Set(allIds).size !== 13) return false;

  const handById = new Map(hand.map(c => [c.id, c]));
  if (!allIds.every(id => handById.has(id))) return false;

  return MELD_KINDS.every(kind => {
    const cards = groups[kind].map(id => handById.get(id)!);
    return validateMeld(cards, kind, trumpCard, deckMode);
  });
}

// ─── Draw pile recycling ─────────────────────────────────────────────────────

/**
 * discardPile's last element is its top card. Keeps that top card aside and
 * shuffles everything else into a fresh draw pile.
 */
export function recyclePile(discardPile: RummyCard[]): { drawPile: RummyCard[]; discardPile: RummyCard[] } {
  if (discardPile.length === 0) return { drawPile: [], discardPile: [] };
  const top = discardPile[discardPile.length - 1];
  return { drawPile: shuffle(discardPile.slice(0, -1)), discardPile: [top] };
}
