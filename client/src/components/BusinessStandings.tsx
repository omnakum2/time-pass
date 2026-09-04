import { BusinessState } from 'shared';
import { StandingsTable } from './StandingsTable';
import { ordinal } from '../format';

/**
 * In-game rank board for Business. Phase 1 = a simple ranking by cash: the richest
 * surviving player first, then any bankrupt players (trailing, worst rank). Reuses the
 * platform's StandingsTable `lr` variant so it matches BidBaazi/Thoso standings styling.
 */
export function BusinessStandings({ state }: { state: BusinessState }) {
  const { players, cash, bankrupt } = state;

  const nameOf = (playerId: string) =>
    players.find((p) => p.id === playerId)?.name ?? 'Unknown';

  const bankruptSet = new Set(bankrupt);

  // Surviving players, richest first.
  const survivors = players
    .filter((p) => !bankruptSet.has(p.id))
    .sort((a, b) => (cash[b.id] ?? 0) - (cash[a.id] ?? 0));

  // Bankrupt players keep their elimination order (earliest out = worst).
  const eliminated = bankrupt
    .map((id) => players.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .reverse();

  const ranked = [...survivors, ...eliminated];

  return (
    <StandingsTable variant="lr">
      <thead>
        <tr>
          <th>Rank</th>
          <th>Player</th>
          <th>Cash</th>
        </tr>
      </thead>
      <tbody>
        {ranked.map((p, i) => {
          const isBankrupt = bankruptSet.has(p.id);
          return (
            <tr key={p.id} className={i === 0 ? 'row-highlight' : undefined}>
              <td>{ordinal(i + 1)}</td>
              <td className={isBankrupt ? 'tag-faint' : undefined}>
                {nameOf(p.id)}
                {isBankrupt && <span className="tag-faint" style={{ marginLeft: 5 }}>(bankrupt)</span>}
              </td>
              <td>₹{(cash[p.id] ?? 0).toLocaleString('en-IN')}</td>
            </tr>
          );
        })}
      </tbody>
    </StandingsTable>
  );
}
