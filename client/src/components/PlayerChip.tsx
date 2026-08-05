import { Player } from 'shared';
import { TurnBorder } from './TurnTimer';

interface Props {
  player: Player;
  bid: number | null;
  tricksWon: number;
  isActive: boolean;
  phase: string;
  turnKey: string;
  timerMs?: number;
  isMe?: boolean;
  totalScore?: number;
}

export function PlayerChip({ player, bid, tricksWon, isActive, phase, turnKey, timerMs, isMe, totalScore }: Props) {
  return (
    <div className={`player-chip${isActive ? ' player-chip--active' : ''}${isMe ? ' player-chip--me' : ''}`}>
      {isActive && (phase === 'BIDDING' || phase === 'PLAYING') && timerMs !== undefined && (
        <TurnBorder key={turnKey} durationMs={timerMs} />
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
          Score: <span className={totalScore >= 0 ? 'delta--pos' : 'delta--neg'}>{totalScore > 0 ? `+${totalScore}` : totalScore}</span>
        </div>
      )}

      {!player.connected && (
        <div className="player-chip__disconnected">disconnected</div>
      )}
    </div>
  );
}
