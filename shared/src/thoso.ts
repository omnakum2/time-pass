// ─── Thoso — pure, side-effect-free card logic ───────────────────────────────
//
// Two DIFFERENT rank orderings are in play here; keep them straight:
//
//   1. PLAY RANKING (Phase 2 "who played the higher card") is ACE-HIGH:
//        A > K > Q > J > 10 > 9 > … > 2
//      This is exactly the shared `RANK_ORDER` (index 0 = '2', last = 'A'), so a
//      higher index means a higher card. Used by `highestLedSuitPlayer`.
//
//   2. TRANSFER SEQUENCE (Phase 1 "who can I hand this card to") is a CYCLIC,
//      ACE-LOW ring:
//        A, 2, 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K → (wraps back to) A
//      A card of rank R transfers to a holder of its PREDECESSOR rank R−1 in this
//      ring. So predecessor(3)=2, predecessor(2)=A, predecessor(A)=K (the wrap),
//      predecessor(K)=Q, etc. Used by `transferPredecessorRank` and friends.

import { Card, Rank, Suit, TrickCard } from './types';
import { SUITS, RANK_ORDER } from './constants';

// ─── Deck ────────────────────────────────────────────────────────────────────

/**
 * A standard 52-card deck. Card ids match how `Card.id` is formed elsewhere in
 * the codebase: `${rank}${suit}` (e.g. "AH", "10D").
 */
export function makeDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANK_ORDER) {
      deck.push({ id: `${rank}${suit}`, rank, suit });
    }
  }
  return deck;
}

// ─── Transfer sequence (cyclic, Ace-low) ─────────────────────────────────────

// The cyclic transfer ring, Ace-LOW. A card of rank R hands off to a holder of
// the rank one step BEHIND it here; the ring wraps so predecessor(A) === 'K'.
const TRANSFER_RING: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

/**
 * The predecessor rank (R−1) in the cyclic Ace-low transfer ring.
 * predecessor(3)=2, predecessor(2)=A, predecessor(A)=K (wrap), predecessor(K)=Q.
 */
export function transferPredecessorRank(rank: Rank): Rank {
  const i = TRANSFER_RING.indexOf(rank);
  // (i - 1 + len) % len wraps 'A' (index 0) around to 'K' (last index).
  return TRANSFER_RING[(i - 1 + TRANSFER_RING.length) % TRANSFER_RING.length];
}

/**
 * The face-up TOP card of a pile (a stack whose top is the LAST element), or null
 * for an empty pile. Only this card is public in Phase 1.
 */
export function topCard(pile: Card[]): Card | null {
  return pile[pile.length - 1] ?? null;
}

/**
 * The ids of players whose pile's face-up TOP card is the transfer-predecessor
 * rank of `cardRank` (any suit) — i.e. everyone a card of that rank could legally
 * be transferred to. Transfers land on TOP of a pile, so only the top card
 * matters. Pass `exceptPlayerId` to exclude the card's current owner.
 */
export function eligibleTransferTargets(
  cardRank: Rank,
  piles: Record<string, Card[]>,
  exceptPlayerId?: string,
): string[] {
  const wanted = transferPredecessorRank(cardRank);
  const targets: string[] = [];
  for (const playerId of Object.keys(piles)) {
    if (playerId === exceptPlayerId) continue;
    if (topCard(piles[playerId])?.rank === wanted) targets.push(playerId);
  }
  return targets;
}

/**
 * True iff a card of `cardRank` has at least one eligible transfer target (see
 * `eligibleTransferTargets`). `exceptPlayerId` excludes the current owner.
 */
export function isTransferable(
  cardRank: Rank,
  piles: Record<string, Card[]>,
  exceptPlayerId?: string,
): boolean {
  return eligibleTransferTargets(cardRank, piles, exceptPlayerId).length > 0;
}

// ─── Playing a trick (Phase 2) ───────────────────────────────────────────────

/**
 * The subset of `hand` that is legal to play right now.
 * - `requireAceOfSpades` (the Phase-2 opening lead) → only the Ace of Spades is legal.
 * - `ledSuit` null (you are the leader) → every card is legal.
 * - Holding the led suit → you must follow suit (only those cards are legal).
 * - Void in the led suit → every card is legal (a Thoso is forced).
 */
export function legalPlays(hand: Card[], ledSuit: Suit | null, requireAceOfSpades = false): Card[] {
  if (requireAceOfSpades) return hand.filter(c => c.rank === 'A' && c.suit === 'S');
  if (ledSuit === null) return hand;
  const followers = hand.filter(c => c.suit === ledSuit);
  return followers.length > 0 ? followers : hand;
}

/**
 * True iff playing `card` is a "Thoso" (an off-suit discard): there IS a led
 * suit, the card does not match it, AND the hand is completely void of the led
 * suit (so following suit was impossible).
 */
export function isThoso(card: Card, ledSuit: Suit | null, hand: Card[]): boolean {
  if (ledSuit === null) return false;
  if (card.suit === ledSuit) return false;
  return !hand.some(c => c.suit === ledSuit);
}

/**
 * Among the trick's cards that follow the led suit, the id of the player who
 * played the HIGHEST one (Ace-high ranking). Returns null if no card of the led
 * suit was played. On a rank tie (not possible with a real 52-card deck, since
 * ranks within a suit are unique) the earliest-played card is kept.
 */
export function highestLedSuitPlayer(trick: TrickCard[], ledSuit: Suit): string | null {
  const led = trick.filter(tc => tc.card.suit === ledSuit);
  if (led.length === 0) return null;
  const best = led.reduce((top, tc) =>
    RANK_ORDER.indexOf(tc.card.rank) > RANK_ORDER.indexOf(top.card.rank) ? tc : top,
  );
  return best.playerId;
}
