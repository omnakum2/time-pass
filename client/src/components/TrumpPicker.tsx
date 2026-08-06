import { Suit, TRUMP_SPECIALS } from 'shared';
import { sendMsg } from '../net/socket';
import { CountdownRing } from './CountdownRing';

const SUIT_SYMBOL: Record<Suit, string> = { D: '♦', C: '♣', H: '♥', S: '♠' };
const SUITS: Suit[] = ['S', 'H', 'D', 'C'];
const RED = new Set<Suit>(['D', 'H']);

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
          {SUITS.map(s => (
            <button
              key={s}
              className={`trump-picker__suit ${RED.has(s) ? 'suit-red' : 'suit-black'}`}
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
