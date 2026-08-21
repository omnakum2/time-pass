import { Card, Rank, Suit, TrickCard, RoundScore, GameMode, TrumpConfig, Announcement } from './types';
import { RANK_ORDER, SUITS } from './constants';

// ─── Rank ordering (higher index = higher rank) ──────────────────────────────

export function rankValue(rank: Rank): number {
  return RANK_ORDER.indexOf(rank);
}

// ─── Rounds per game mode ────────────────────────────────────────────────────

export function roundsForMode(mode: GameMode): number[] {
  if (mode === 'upDown') return [1, 2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 1];
  return [7, 6, 5, 4, 3, 2, 1]; // classic + blind
}

// ─── Deck ────────────────────────────────────────────────────────────────────

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANK_ORDER) {
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
 * Deals the round from a freshly shuffled deck.
 * Returns { hands }, an array of hands where the array index is the seat index
 * (hands[0] is seat 0, hands[1] is seat 1, …). Each hand has `roundNumber` cards.
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
 * Returns the seat index of the first bidder for a given round, keyed off the
 * round's 0-based sequence index (index 0 → seat 0, index 1 → seat 1, …; wraps
 * with playerCount). Using the sequence index makes the opening bid advance
 * exactly one seat per round in every game mode.
 * For Classic/Blind/Revolving-Trump (rounds run 7→1) `roundIndex === 7 - round`,
 * so this matches the old behaviour; only Up & Down changes.
 */
export function firstBidderSeat(roundIndex: number, playerCount: number): number {
  return roundIndex % playerCount;
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

const AK47_RANKS: Rank[] = ['A', 'K', '4', '7'];
const KQ_RANKS: Rank[] = ['K', 'Q'];

function isTrumpCard(card: Card, cfg: TrumpConfig): boolean {
  switch (cfg.kind) {
    case 'suit':      return card.suit === cfg.suit;
    case 'ak47':      return AK47_RANKS.includes(card.rank);
    case 'kingQueen': return KQ_RANKS.includes(card.rank);
    case 'oneTrump':  return card.rank === cfg.rank;
    default:          return false; // noTrump, lowCard have no trump cards
  }
}

// Winner among `cards` (a subset of the trick, in play order). Highest rank wins;
// on a rank tie (e.g. two Kings) the card played FIRST wins (reduce keeps `best`).
function highestOf(cards: TrickCard[]): TrickCard {
  return cards.reduce((best, tc) => rankValue(tc.card.rank) > rankValue(best.card.rank) ? tc : best);
}
function lowestOf(cards: TrickCard[]): TrickCard {
  return cards.reduce((best, tc) => rankValue(tc.card.rank) < rankValue(best.card.rank) ? tc : best);
}

// Winner among the trump cards. Highest rank wins (natural order — e.g. AK47 is
// A>K>7>4). If several trumps share that top rank (suit is ignored for trump
// status, so ties happen — e.g. two Aces, or every card in One Trump), the one
// matching the led suit wins; otherwise the earliest-played (ties keep first).
function winningTrump(trumps: TrickCard[], leadSuit: Suit): TrickCard {
  const top = Math.max(...trumps.map(tc => rankValue(tc.card.rank)));
  const tied = trumps.filter(tc => rankValue(tc.card.rank) === top);
  if (tied.length === 1) return tied[0];
  return tied.find(tc => tc.card.suit === leadSuit) ?? tied[0];
}

/**
 * Determines the winning TrickCard, generalized over all Revolving-Trump options.
 *  - If any trump cards were played → highest-ranked trump; on a same-rank tie the
 *    trump matching the led suit wins, else the card played first.
 *  - Otherwise only the led suit is eligible → Low Card = lowest of the led suit,
 *    No Trump / everything else = highest of the led suit.
 * Follow-suit legality is unchanged (see legalMoves).
 */
export function trickWinner(trick: TrickCard[], leadSuit: Suit, cfg: TrumpConfig): TrickCard {
  const trumps = trick.filter(tc => isTrumpCard(tc.card, cfg));
  if (trumps.length > 0) return winningTrump(trumps, leadSuit);
  // No trump played: only the led suit is eligible (a void player's off-suit card
  // can't win). Low Card takes the lowest of the led suit; everything else the highest.
  const led = trick.filter(tc => tc.card.suit === leadSuit);
  const eligible = led.length ? led : trick;
  return cfg.kind === 'lowCard' ? lowestOf(eligible) : highestOf(eligible);
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

/** Up & Down's peak: the 7-card Summit round (×3, first bidder calls the trump). */
export function isSummitRound(mode: GameMode, cards: number): boolean {
  return mode === 'upDown' && cards === 7;
}

/** Up & Down's final round: the ×10 Last Stand (lowest score calls the trump). */
export function isLastStandRound(mode: GameMode, seqIndex: number, totalRounds: number): boolean {
  return mode === 'upDown' && seqIndex === totalRounds - 1;
}

/**
 * Score multiplier for a round. Up & Down escalates stakes by hand size: 1× normal
 * (1–3 cards), 2× high-stakes (4–6), 3× at the 7-card Summit, and ×10 on the final
 * Last Stand. Every other mode is a flat ×1.
 * (Blind Bid's LOCK ×2 / PUSH ×3 are applied separately, per-player, at score time.)
 */
export function roundMultiplier(mode: GameMode, seqIndex: number, totalRounds: number, cards: number): number {
  if (mode !== 'upDown') return 1;
  if (isLastStandRound(mode, seqIndex, totalRounds)) return 10;
  if (isSummitRound(mode, cards)) return 3;
  if (cards >= 4) return 2; // High Stakes (4–6 cards)
  return 1;                 // Normal (1–3 cards)
}

// ─── Round announcements ─────────────────────────────────────────────────────

const MODE_INTRO: Record<GameMode, Announcement> = {
  classic:        { title: 'Classic', subtitle: 'Predict your tricks · random trump each round', variant: 'intro' },
  revolvingTrump: { title: 'Revolving Trump', subtitle: 'The first bidder calls the trump', variant: 'intro' },
  blind:          { title: 'Blind Bid', subtitle: 'Bid blind, then lock or push your luck', variant: 'intro' },
  upDown:         { title: 'Up & Down', subtitle: '13 rounds · rise and fall · survive', variant: 'intro' },
  coinRush:       { title: 'Coin Rush', subtitle: 'Win chips + the Jackpot · cash out by rank', variant: 'intro' },
};

/**
 * The banner to show at the start of a round, or null for an ordinary round.
 * Round 1 of every mode shows its intro. In Up & Down we announce EVERY stakes
 * change (rise or fall) — plus the Summit and Last Stand with their own copy.
 */
export function announcementFor(mode: GameMode, seqIndex: number, rounds: number[]): Announcement | null {
  if (seqIndex === 0) return MODE_INTRO[mode];
  if (mode !== 'upDown') return null;

  const totalRounds = rounds.length;
  const cards = rounds[seqIndex];
  const multiplier = roundMultiplier(mode, seqIndex, totalRounds, cards);
  const previousMultiplier = roundMultiplier(mode, seqIndex - 1, totalRounds, rounds[seqIndex - 1]);
  if (multiplier === previousMultiplier) return null; // stakes unchanged — no banner

  if (isLastStandRound(mode, seqIndex, totalRounds)) {
    return { title: 'Last Stand', subtitle: 'For last place · they call the trump', multiplier, icon: 'swords', variant: 'lastStand' };
  }
  if (isSummitRound(mode, cards)) {
    return { title: 'Summit', subtitle: 'Highest stakes · wins & losses', multiplier, icon: 'crown', variant: 'summit' };
  }
  if (multiplier > previousMultiplier) {
    return { title: 'Stakes Rising', subtitle: 'Wins & losses grow', multiplier, icon: 'trendingUp', variant: 'stakesUp' };
  }
  return {
    title: multiplier === 1 ? 'Back to Normal' : 'Stakes Easing',
    subtitle: 'Wins & losses shrink',
    multiplier, icon: 'trendingDown', variant: 'stakesDown',
  };
}

/** Latest running total from a player's score rows (0 if none). */
export function latestTotal(rows: RoundScore[]): number {
  return rows.length > 0 ? rows[rows.length - 1].total : 0;
}
