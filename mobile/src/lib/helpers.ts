import type { Player, Scoreboard } from 'shared';
import { latestTotal } from 'shared';
import { STATUS_COLORS } from '../theme';

/** Format a score delta with an explicit sign: 5 → "+5", -3 → "-3", 0 → "0". */
export function formatDelta(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

/** A player's latest running total from the scoreboard (0 if none). */
export function getTotal(scoreboard: Scoreboard, playerId: string): number {
  return latestTotal(scoreboard[playerId] ?? []);
}

/** Look up a player's display name by id. */
export function playerName(players: Player[], id: string): string {
  return players.find(p => p.id === id)?.name ?? '?';
}

/** Traffic-light color for a countdown fraction (0 = fresh … 1 = expired). */
export function timerColor(fraction: number): string {
  return fraction < 0.6 ? STATUS_COLORS.success : fraction < 0.85 ? STATUS_COLORS.warning : STATUS_COLORS.danger;
}
