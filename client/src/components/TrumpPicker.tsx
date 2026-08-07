import { TRUMP_SPECIALS, SUIT_SYMBOL, SUIT_ORDER, isRedSuit } from 'shared';
import { sendMsg } from '../net/socket';
import { CountdownRing } from './CountdownRing';

interface Props { turnKey: string; durationMs: number; }

export function TrumpPicker({ turnKey, durationMs }: Props) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
        <span style={{ opacity: 0.7, fontSize: '0.85rem' }}>Time left:</span>
        <CountdownRing durationMs={durationMs} startKey={turnKey} />
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
          {TRUMP_SPECIALS.map(o => (
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
