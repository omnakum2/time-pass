import { Card, Rank, Suit, TrickCard } from './types';

// ─── Rank ordering (higher index = higher rank) ──────────────────────────────

const RANK_ORDER: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export function rankValue(rank: Rank): number {
  return RANK_ORDER.indexOf(rank);
}

// ─── Deck ────────────────────────────────────────────────────────────────────

const SUITS: Suit[] = ['D', 'C', 'H', 'S'];
const RANKS: Rank[] = RANK_ORDER;

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ id: `${rank}${suit}`, rank, suit });
    }
  }
  return deck;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Dealing ─────────────────────────────────────────────────────────────────

/**
 * Returns a map: seatIndex → cards dealt.
 * roundNumber = 7..1, playerCount ≤ 7.
 */
export function deal(
  roundNumber: number,
  playerCount: number
): { hands: Card[][] } {
  const deck = shuffle(createDeck());
  const hands: Card[][] = [];
  for (let i = 0; i < playerCount; i++) {
    hands.push(deck.splice(0, roundNumber));
  }
  return { hands };
}

// ─── Trump selection ─────────────────────────────────────────────────────────

const TRUMP_OPTIONS: (Suit | null)[] = ['D', 'C', 'H', 'S', null]; // null = No-Trump

// Randomly pick a trump for the round, never repeating the previous round's trump.
// prev === undefined means "no previous round yet" (first round may be anything).
export function pickTrump(prev: Suit | null | undefined): Suit | null {
  const options = prev === undefined ? TRUMP_OPTIONS : TRUMP_OPTIONS.filter(t => t !== prev);
  return options[Math.floor(Math.random() * options.length)];
}

// ─── Bidding order ───────────────────────────────────────────────────────────

/**
 * Returns the seat index of the first bidder for a given round.
 * Round 7 → seat 0, Round 6 → seat 1, etc. (wraps with playerCount)
 */
export function firstBidderSeat(round: number, playerCount: number): number {
  return (7 - round) % playerCount;
}

// ─── Legal moves ─────────────────────────────────────────────────────────────

/**
 * Returns the subset of the player's hand that are legal to play.
 * - If no lead suit yet (player is leading), all cards are legal.
 * - Otherwise must follow lead suit if possible; else any card.
 */
export function legalMoves(hand: Card[], leadSuit: Suit | null): Card[] {
  if (leadSuit === null) return hand;
  const suited = hand.filter(c => c.suit === leadSuit);
  return suited.length > 0 ? suited : hand;
}

// ─── Trick winner ────────────────────────────────────────────────────────────

/**
 * Determines the winner of a trick.
 * Returns the TrickCard that won.
 * Rules:
 *  - Highest trump played wins.
 *  - If no trump played, highest card of the leading suit wins.
 *  - Off-suit non-trump cards cannot win.
 */
export function trickWinner(
  trick: TrickCard[],
  leadSuit: Suit,
  trump: Suit | null
): TrickCard {
  if (trump !== null) {
    const trumpCards = trick.filter(tc => tc.card.suit === trump);
    if (trumpCards.length > 0) {
      return trumpCards.reduce((best, tc) =>
        rankValue(tc.card.rank) > rankValue(best.card.rank) ? tc : best
      );
    }
  }
  const leadCards = trick.filter(tc => tc.card.suit === leadSuit);
  return leadCards.reduce((best, tc) =>
    rankValue(tc.card.rank) > rankValue(best.card.rank) ? tc : best
  );
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

/**
 * Computes the delta (points earned/lost) for one round.
 *
 * | bid=0, won=0         | +10         |
 * | bid=0, won>0         | -10 (flat)  |
 * | bid>0, won=bid       | bid×11      |
 * | bid>0, won≠bid       | -(bid×10)   |
 */
export function scoreRound(bid: number, won: number): number {
  if (bid === 0) {
    return won === 0 ? 10 : -10;
  }
  if (won === bid) {
    return bid * 11;
  }
  return -(bid * 10);
}
