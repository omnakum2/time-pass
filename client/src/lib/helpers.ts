import type { Player, Scoreboard } from 'shared';
import { latestTotal } from 'shared';

// Read the semantic status colors from the CSS --success/--warning/--danger tokens
// so index.css stays the single source of truth. Resolved once at module load, for
// places that need a color *string* (SVG stroke, canvas confetti). Fallbacks match
// the CSS values and only apply if the vars aren't mounted yet.
function cssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}
export const STATUS_COLORS = {
  success: cssVar('--success', '#5FD07A'),
  warning: cssVar('--warning', '#FFB300'),
  danger: cssVar('--danger', '#F0736C'),
} as const;

/** Format a score delta with an explicit sign: 5 → "+5", -3 → "-3", 0 → "0". */
export function formatDelta(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

/** CSS class for a delta's sign (0 counts as positive). */
export function deltaClass(n: number): string {
  return n >= 0 ? 'delta--pos' : 'delta--neg';
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
