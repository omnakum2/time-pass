import { Player } from 'shared';
import { CardBack } from './CardView';
import { TurnTimer } from './TurnTimer';

const SUIT_SYMBOL: Record<string, string> = { D: '♦', C: '♣', H: '♥', S: '♠' };

interface Props {
  players: Player[];
  myId: string;
  handCounts: Record<string, number>;
  bids: Record<string, number | null>;
  tricksWon: Record<string, number>;
  currentTurn: string | null;
  phase: string;
  turnKey: string;
}

export function OpponentsRow({ players, myId, handCounts, bids, tricksWon, currentTurn, phase, turnKey }: Props) {
  const opponents = players.filter(p => p.id !== myId);

  return (
    <div className="opponents-row">
      {opponents.map(p => {
        const isActive = currentTurn === p.id;
        const cardCount = handCounts[p.id] ?? 0;
        const bid = bids[p.id];
        const won = tricksWon[p.id] ?? 0;

        return (
          <div key={p.id} className={`opponent-chip${isActive ? ' opponent-chip--active' : ''}`}>
            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
              {p.name}
              {!p.connected && <span style={{ opacity: 0.4 }}> ·</span>}
            </div>

            {/* Mini card backs */}
            <div style={{ display: 'flex', gap: 2 }}>
              {Array.from({ length: Math.min(cardCount, 7) }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: 14, height: 20, borderRadius: 2,
                    background: 'linear-gradient(135deg,#1a3a6b,#2c5fad)',
                    border: '1px solid #fff2',
                    marginLeft: i > 0 ? -8 : 0,
                  }}
                />
              ))}
            </div>

            <div style={{ fontSize: '0.7rem', opacity: 0.75 }}>
              {bid !== null ? `Bid ${bid}` : 'Bidding…'} · Won {won}
            </div>

            {isActive && (phase === 'BIDDING' || phase === 'PLAYING') && (
              <TurnTimer
                durationMs={phase === 'BIDDING' ? 10_000 : 30_000}
                startKey={turnKey}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
