// Small formatting helpers shared across the client.

import { Card, Player, SUIT_ORDER, RANK_ORDER } from 'shared';

/** Ordinal label for a positive integer: 1 → "1st", 2 → "2nd", 3 → "3rd", 11 → "11th"… */
export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

/** Sort a hand suit-grouped (♠♥♣♦) then rank 2→A. Returns a new array (input untouched). */
export function sortHand(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    const s = SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit);
    return s !== 0 ? s : RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank);
  });
}

/** Opponents in clockwise seat order starting just after me. */
export function seatOrderedOpponents(players: Player[], playerId: string): Player[] {
  const me = players.find(p => p.id === playerId);
  if (!me) return players.filter(p => p.id !== playerId);
  const n = players.length;
  const out: Player[] = [];
  for (let i = 1; i < n; i++) {
    const seatIdx = (me.seatIndex + i) % n;
    const opp = players.find(p => p.seatIndex === seatIdx);
    if (opp) out.push(opp);
  }
  return out;
}
