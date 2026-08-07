import { Player } from 'shared';
import { TurnBorder } from './TurnTimer';
import { useGameStore } from '../store/gameStore';

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
  const bubble = useGameStore(s => s.activeBubbles[player.id]);
  return (
    <div className={`player-chip${isActive ? ' player-chip--active' : ''}${isMe ? ' player-chip--me' : ''}`}>
      {bubble && (
        <div className={`chat-bubble${isMe ? '' : ' chat-bubble--below'}`} key={bubble.key}>
          {bubble.text}
        </div>
      )}
      {isActive && (phase === 'BIDDING' || phase === 'PLAYING' || phase === 'TRUMP_SELECT') && timerMs !== undefined && (
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
