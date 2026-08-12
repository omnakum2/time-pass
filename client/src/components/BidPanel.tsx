import { sendMsg } from '../net/socket';
import { CountdownRing } from './CountdownRing';

interface Props {
  round: number;
  remainingMs: number;
  fullMs: number;
  startKey: string;
  running?: boolean;
}

export function BidPanel({ round, remainingMs, fullMs, startKey, running }: Props) {
  const bids = Array.from({ length: round + 1 }, (_, i) => i);
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
        <span className="hint">Time left:</span>
        <CountdownRing remainingMs={remainingMs} fullMs={fullMs} startKey={startKey} running={running} />
      </div>
      <div className="bid-buttons">
        {bids.map(b => (
          <button key={b} className="bid-btn" onClick={() => sendMsg({ type: 'placeBid', bid: b })}>{b}</button>
        ))}
      </div>
    </>
  );
}
