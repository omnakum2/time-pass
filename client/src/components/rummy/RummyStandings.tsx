import { StandingsTable } from '../StandingsTable';

interface Row { playerId: string; name: string; rank: number; isMe: boolean }

export function RummyStandings({ rows }: { rows: Row[] }) {
  const sorted = [...rows].sort((a, b) => a.rank - b.rank);
  return (
    <StandingsTable variant="lr">
      <tbody>
        {sorted.map(r => (
          <tr key={r.playerId}>
            <td>{r.rank}. {r.name}{r.isMe ? ' (you)' : ''}</td>
            <td>{r.rank === 1 ? '🏆' : ''}</td>
          </tr>
        ))}
      </tbody>
    </StandingsTable>
  );
}
