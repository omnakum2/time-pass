import { ThosoState } from 'shared';
import { StandingsTable } from './StandingsTable';
import { ordinal } from '../format';

/**
 * In-game rank board for Thoso. Shows the finished ("free") players in finishing
 * order (from `state.finishedRanks`), then — for context — the players still
 * holding cards. Reuses the platform's StandingsTable `lr` variant so it matches
 * BidBaazi's Winner standings styling.
 */
export function ThosoStandings({ state }: { state: ThosoState }) {
  const { players, finishedRanks } = state;

  const nameOf = (playerId: string) =>
    players.find((p) => p.id === playerId)?.name ?? 'Unknown';

  // Free players, safest ranking first.
  const finished = [...finishedRanks].sort((a, b) => a.rank - b.rank);
  const finishedIds = new Set(finished.map((f) => f.playerId));

  // Everyone still holding cards (not yet finished), in seat order.
  const stillPlaying = players
    .filter((p) => !finishedIds.has(p.id))
    .sort((a, b) => a.seatIndex - b.seatIndex);

  if (finished.length === 0) {
    return (
      <div className="text-center tag-faint" style={{ padding: '12px' }}>
        No one is free yet.
      </div>
    );
  }

  return (
    <StandingsTable variant="lr">
      <thead>
        <tr>
          <th>Rank</th>
          <th>Player</th>
        </tr>
      </thead>
      <tbody>
        {finished.map((f) => (
          <tr key={f.playerId}>
            <td>{ordinal(f.rank)}</td>
            <td>{nameOf(f.playerId)}</td>
          </tr>
        ))}
        {stillPlaying.length > 0 && (
          <>
            <tr>
              <td className="tag-faint">Still playing</td>
              <td />
            </tr>
            {stillPlaying.map((p) => (
              <tr key={p.id}>
                <td className="tag-faint">·</td>
                <td>{p.name}</td>
              </tr>
            ))}
          </>
        )}
      </tbody>
    </StandingsTable>
  );
}
