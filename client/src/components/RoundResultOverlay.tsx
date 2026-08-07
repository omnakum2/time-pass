import { MsgRoundResult } from 'shared';
import { Modal } from './Modal';
import { Delta } from './Delta';

interface Props {
  result: MsgRoundResult | null;
  visible: boolean;
}

export function RoundResultOverlay({ result, visible }: Props) {
  if (!result) return null;

  return (
    <Modal open={visible} dismissable={false} title={`Round ${result.round} Over`}>
      {result.perPlayer.map(p => (
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
