import type { ReactNode } from 'react';

/**
 * Shared styled table shell (scrollable, `.scoreboard` cell styling) that both the
 * in-game Scoreboard (per-round matrix) and the Winner standings render through.
 * Callers provide their own <thead>/<tbody>.
 */
export function StandingsTable({ children }: { children: ReactNode }) {
  return (
    <div className="scoreboard-scroll">
      <table className="scoreboard">{children}</table>
    </div>
  );
}
