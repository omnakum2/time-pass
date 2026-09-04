// shared/src/business.ts — pure, side-effect-free Business logic + board-config re-export.
export * from './business/board.config';

import { BOARD, BoardTile, PropertyTile } from './business/board.config';

// Player token / building-pip colours (kept distinct from the 4 property-group colours).
export const PLAYER_COLOURS = ['#a855f7', '#22d3ee', '#f472b6', '#fb923c'] as const;

/** Roll two dice (1–6 each). */
export function rollDice(): [number, number] {
  return [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
}

/** Sum of a dice pair (also selects the dice-parity Chance/Chest outcome). */
export function diceTotal(d: [number, number]): number { return d[0] + d[1]; }

/** Advance `steps` around the 36-tile loop; `passedStart` flags the START bonus. */
export function advance(pos: number, steps: number): { pos: number; passedStart: boolean } {
  return { pos: (pos + steps) % BOARD.length, passedStart: pos + steps >= BOARD.length };
}

export function tileAt(pos: number): BoardTile { return BOARD[pos]; }
export function isProperty(t: BoardTile): t is PropertyTile { return t.type === 'property'; }
