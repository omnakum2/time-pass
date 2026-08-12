import type { ReactNode } from 'react';

/**
 * Shared styled table shell (scrollable, `.scoreboard` cell styling) that both the
 * in-game Scoreboard (per-round matrix) and the Winner standings render through.
 * Callers provide their own <thead>/<tbody>.
 *
 * Pass `variant="matrix"` for the scrollable per-round grid (sticky first column +
 * highlighted Total row). Pass `variant="lr"` for the 2-column Winner standings
 * (names left, scores right). Omit it for a plain centered table (e.g. Round Over).
 */
export function StandingsTable({ variant, children }: { variant?: 'matrix' | 'lr'; children: ReactNode }) {
  const cls = variant === 'matrix' ? 'scoreboard scoreboard--matrix'
    : variant === 'lr' ? 'scoreboard scoreboard--lr'
    : 'scoreboard';
  return (
    <div className="scoreboard-scroll">
      <table className={cls}>{children}</table>
    </div>
  );
}
