import { GameState } from 'shared';
import { StandingsTable } from './StandingsTable';
import { Delta } from './Delta';

export function Scoreboard({ gameState }: { gameState: GameState }) {
  const { players, scoreboard } = gameState;

  // Rows are keyed by SEQUENCE INDEX (not round number). Modes that repeat a
  // round number — e.g. Up & Down's 1..7..1 — need every played round shown,
  // and round numbers alone would collide. Row count = longest per-player history.
  const roundCount = players.reduce((max, p) => Math.max(max, scoreboard[p.id]?.length ?? 0), 0);

  if (roundCount === 0) {
    return (
      <div className="text-center tag-faint" style={{ padding: '12px' }}>
        Scores will appear here
      </div>
    );
  }

  // Label for row i = the round number any player recorded at that index.
  const roundLabel = (i: number) => {
    for (const p of players) {
      const row = scoreboard[p.id]?.[i];
      if (row) return row.round;
    }
    return i + 1;
  };

  const getTotal = (playerId: string) => {
    const rows = scoreboard[playerId] ?? [];
    return rows.length > 0 ? rows[rows.length - 1].total : 0;
  };

  return (
    <StandingsTable variant="matrix">
      <thead>
        <tr>
          <th>#</th>
          {players.map(p => (
            <th key={p.id}>{p.name}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: roundCount }, (_, i) => (
          <tr key={i}>
            <td>R{roundLabel(i)}</td>
            {players.map(p => {
              const row = scoreboard[p.id]?.[i];
              if (!row) return <td key={p.id}>-</td>;
              return (
                <td key={p.id}>
                  <Delta value={row.delta} />
                </td>
              );
            })}
          </tr>
        ))}
        <tr>
          <td>Total</td>
          {players.map(p => (
            <td key={p.id}>{getTotal(p.id)}</td>
          ))}
        </tr>
      </tbody>
    </StandingsTable>
  );
}
