import { GameState } from 'shared';
import { StandingsTable } from './StandingsTable';
import { Delta } from './Delta';

const ALL_ROUNDS = [7, 6, 5, 4, 3, 2, 1];

export function Scoreboard({ gameState }: { gameState: GameState }) {
  const { players, scoreboard } = gameState;

  const roundsPlayed = ALL_ROUNDS.filter(r =>
    players.some(p => scoreboard[p.id]?.some(row => row.round === r))
  );

  if (roundsPlayed.length === 0) {
    return (
      <div style={{ padding: '12px', opacity: 0.5, fontSize: '0.8rem', textAlign: 'center' }}>
        Scores will appear here
      </div>
    );
  }

  const getRow = (playerId: string, round: number) =>
    scoreboard[playerId]?.find(r => r.round === round);

  const getTotal = (playerId: string) => {
    const rows = scoreboard[playerId] ?? [];
    return rows.length > 0 ? rows[rows.length - 1].total : 0;
  };

  return (
    <StandingsTable>
      <thead>
        <tr>
          <th>#</th>
          {players.map(p => (
            <th key={p.id}>{p.name}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {roundsPlayed.map(r => (
          <tr key={r}>
            <td>R{r}</td>
            {players.map(p => {
              const row = getRow(p.id, r);
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
