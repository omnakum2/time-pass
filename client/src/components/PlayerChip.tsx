import { Player } from 'shared';
import { TurnBorder } from './TurnTimer';
import { Delta } from './Delta';

interface Props {
  player: Player;
  bid: number | null;
  tricksWon: number;
  isActive: boolean;
  phase: string;
  turnKey: string;
  durationMs?: number;
  isMe?: boolean;
  totalScore?: number;
}

export function PlayerChip({ player, bid, tricksWon, isActive, phase, turnKey, durationMs, isMe, totalScore }: Props) {
  return (
    <div className={`player-chip${isActive ? ' player-chip--active' : ''}${isMe ? ' player-chip--me' : ''}`}>
      {isActive && (phase === 'BIDDING' || phase === 'PLAYING') && durationMs !== undefined && (
        <TurnBorder key={turnKey} durationMs={durationMs} />
      )}

      <div className="player-chip__name">
        {player.name}
        {isMe && <span style={{ opacity: 0.5, fontSize: '0.7em', marginLeft: 4 }}>(you)</span>}
      </div>

      <div className="player-chip__stats">
        {bid !== null ? `Bid ${bid}` : (phase === 'BIDDING' ? 'bidding…' : 'no bid')}
        {' · '}Won {tricksWon}
      </div>

      {totalScore !== undefined && (
        <div className="player-chip__total">
          Score: <Delta value={totalScore} />
        </div>
      )}

      {!player.connected && (
        <div className="player-chip__disconnected">disconnected</div>
      )}
    </div>
  );
}
