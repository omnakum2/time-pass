import { MsgRoundResult } from 'shared';
import { Modal } from './Modal';
import { Delta } from './Delta';
import { StandingsTable } from './StandingsTable';

interface Props {
  result: MsgRoundResult | null;
  visible: boolean;
}

export function RoundResultOverlay({ result, visible }: Props) {
  // Rank by running total (leader first) so the Rank-1 row can be highlighted.
  const rows = result ? [...result.perPlayer].sort((a, b) => b.total - a.total) : [];

  return (
    <Modal
      open={visible && !!result}
      dismissable={false}
      title={result ? `Round ${result.round} Over` : undefined}
    >
      <StandingsTable>
        <thead>
          <tr>
            <th>Player</th>
            <th>Bid</th>
            <th>Won</th>
            <th>Points</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.playerId}>
              <td>{p.name}</td>
              <td>{p.bid}</td>
              <td>{p.won}</td>
              <td><Delta value={p.delta} /></td>
              <td className="total-cell">{p.total}</td>
            </tr>
          ))}
        </tbody>
      </StandingsTable>
    </Modal>
  );
}
