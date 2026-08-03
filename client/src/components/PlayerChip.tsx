import { Player } from 'shared';
import { TurnTimer } from './TurnTimer';

interface Props {
  player: Player;
  cardCount: number;
  bid: number | null;
  tricksWon: number;
  isActive: boolean;
  phase: string;
  turnKey: string;
  isMe?: boolean;
}

export function PlayerChip({ player, cardCount, bid, tricksWon, isActive, phase, turnKey, isMe }: Props) {
  const bidding = phase === 'BIDDING';
  const timerMs = bidding ? 30_000 : 30_000;

  return (
    <div className={`player-chip${isActive ? ' player-chip--active' : ''}`}>
      <div className="player-chip__name">
        {player.name}
        {isMe && <span style={{ opacity: 0.5, fontSize: '0.7em', marginLeft: 4 }}>(you)</span>}
      </div>

      {/* Mini card backs */}
      {!isMe && (
        <div className="player-chip__cards">
          {Array.from({ length: Math.min(cardCount, 7) }).map((_, i) => (
            <div key={i} className="player-chip__mini-card" />
          ))}
          {cardCount === 0 && <span style={{ opacity: 0.3, fontSize: '0.7rem' }}>no cards</span>}
        </div>
      )}

      <div className="player-chip__stats">
        {bid !== null ? `Bid ${bid}` : (phase === 'BIDDING' ? 'bidding…' : '—')}
        {' · '}Won {tricksWon}
      </div>

      {!player.connected && (
        <div className="player-chip__disconnected">disconnected</div>
      )}

      {isActive && (phase === 'BIDDING' || phase === 'PLAYING') && (
        <TurnTimer durationMs={timerMs} startKey={turnKey} />
      )}
    </div>
  );
}
