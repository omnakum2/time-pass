import { TRUMP_SPECIALS, SUIT_SYMBOL, SUIT_ORDER, isRedSuit } from 'shared';
import { sendMsg } from '../net/socket';
import { CountdownRing } from './CountdownRing';

interface Props { remainingMs: number; fullMs: number; startKey: string; running?: boolean; limited?: boolean; }

export function BidBaaziTrumpPicker({ remainingMs, fullMs, startKey, running, limited }: Props) {
  // Up & Down (Summit + Last Stand) offers only a trump suit or No Trump — no specials.
  const specials = limited ? TRUMP_SPECIALS.filter(o => o.kind === 'noTrump') : TRUMP_SPECIALS;
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
        <span style={{ opacity: 0.7, fontSize: '0.85rem' }}>Time left:</span>
        <CountdownRing remainingMs={remainingMs} fullMs={fullMs} startKey={startKey} running={running} />
      </div>
      <div className="trump-picker">
        <div className="trump-picker__suits">
          {SUIT_ORDER.map(s => (
            <button
              key={s}
              className={`trump-picker__suit ${isRedSuit(s) ? 'suit-red' : 'suit-black'}`}
              onClick={() => sendMsg({ type: 'selectTrump', kind: 'suit', suit: s })}
            >
              {SUIT_SYMBOL[s]}
            </button>
          ))}
        </div>
        <div className="trump-picker__specials">
          {specials.map(o => (
            <button
              key={o.kind}
              className="trump-picker__special"
              onClick={() => sendMsg({ type: 'selectTrump', kind: o.kind })}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
