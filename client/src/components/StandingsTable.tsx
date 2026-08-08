import type { ReactNode } from 'react';

/**
 * Shared styled table shell (scrollable, `.scoreboard` cell styling) that both the
 * in-game Scoreboard (per-round matrix) and the Winner standings render through.
 * Callers provide their own <thead>/<tbody>.
 *
 * Pass `variant="matrix"` for the scrollable per-round grid, which adds a sticky
 * first column and a highlighted last ("Total") row. The Winner standings — a plain
 * ranked list — omit it so those matrix-only styles don't apply.
 */
export function StandingsTable({ variant, children }: { variant?: 'matrix'; children: ReactNode }) {
  const cls = variant === 'matrix' ? 'scoreboard scoreboard--matrix' : 'scoreboard';
  return (
    <div className="scoreboard-scroll">
      <table className={cls}>{children}</table>
    </div>
  );
}
