import { Button } from './Button';
import { CountdownRing } from './CountdownRing';

interface Props {
  bid: number;      // the player's blind bid
  cards: number;    // hand size this round (can't push past it)
  remainingMs: number;
  fullMs: number;
  startKey: string;
  running?: boolean;
  onDecide: (push: boolean) => void;
}

/** Blind Bid: after the hand is revealed, LOCK the blind bid (×2) or PUSH it +1 (×3). */
export function PushPanel({ bid, cards, remainingMs, fullMs, startKey, running, onDecide }: Props) {
  const canPush = bid < cards;
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
        <span className="hint">Time left:</span>
        <CountdownRing remainingMs={remainingMs} fullMs={fullMs} startKey={startKey} running={running} />
      </div>
      <p className="push-panel__hint">
        Your blind bid is <strong>{bid}</strong>. Lock it (<strong>×2</strong>), or push to{' '}
        <strong>{bid + 1}</strong> (<strong>×3</strong>): bigger reward, bigger risk.
      </p>
      <div className="push-panel__buttons">
        <Button variant="primary" onClick={() => onDecide(false)}>Lock · ×2</Button>
        {canPush && (
          <Button variant="secondary" onClick={() => onDecide(true)}>Push to {bid + 1} · ×3</Button>
        )}
      </div>
    </>
  );
}
