import { Card, Suit } from './types';
import { SUITS, RANK_ORDER } from './constants';

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

export function legalPlays(hand: Card[], ledSuit: Suit | null, requireAceOfSpades = false): Card[] {
  if (requireAceOfSpades) return hand.filter(c => c.rank === 'A' && c.suit === 'S');
  if (ledSuit === null) return hand;
  const followers = hand.filter(c => c.suit === ledSuit);
  return followers.length > 0 ? followers : hand;
}
