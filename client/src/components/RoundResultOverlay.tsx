import { MsgRoundResult } from 'shared';
import { Modal } from './Modal';
import { Delta } from './Delta';

interface Props {
  result: MsgRoundResult | null;
  visible: boolean;
}

export function RoundResultOverlay({ result, visible }: Props) {
  return (
    <Modal
      open={visible && !!result}
      dismissable={false}
      title={result ? `Round ${result.round} Over` : undefined}
    >
      {result?.perPlayer.map(p => (
        <div key={p.playerId} style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{p.name}</span>
          <span>
            bid {p.bid}, won {p.won} →{' '}
            <Delta value={p.delta} />
            {' '}({p.total})
          </span>
        </div>
      ))}
    </Modal>
  );
}
