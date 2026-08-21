import { MsgRoundResult } from 'shared';
import { Modal } from './Modal';
import { Delta } from './Delta';
import { StandingsTable } from './StandingsTable';

// Non-dismissable modal shown when a round ends. Ranks players by running total
// (leader first) so the top row can be highlighted.
export function RoundResultOverlay({
  result,
  visible,
}: {
  result: MsgRoundResult | null;
  visible: boolean;
}) {
  const rows = result ? [...result.perPlayer].sort((a, b) => b.total - a.total) : [];

  return (
    <Modal
      open={visible && !!result}
      dismissable={false}
      title={result ? `Round ${result.round} Over` : undefined}
    >
      <StandingsTable
        headers={['Player', 'Bid', 'Won', 'Points', 'Total']}
        rows={rows.map((p, i) => ({
          key: p.playerId,
          highlight: i === 0, // round leader
          cells: [p.name, String(p.bid), String(p.won), <Delta value={p.delta} />, String(p.total)],
        }))}
      />
    </Modal>
  );
}
