import { sendMsg } from '../net/socket';
import { CountdownRing } from './CountdownRing';

interface Props {
  round: number;
  turnKey: string;
}

export function BidPanel({ round, turnKey }: Props) {
  const bids = Array.from({ length: round + 1 }, (_, i) => i);
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
        <span style={{ opacity: 0.7, fontSize: '0.85rem' }}>Time left:</span>
        <CountdownRing durationMs={30_000} startKey={turnKey} />
      </div>
      <div className="bid-buttons">
        {bids.map(b => (
          <button key={b} className="bid-btn" onClick={() => sendMsg({ type: 'placeBid', bid: b })}>{b}</button>
        ))}
      </div>
    </>
  );
}
