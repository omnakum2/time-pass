import { Player } from 'shared';
import { TurnBorder } from './TurnTimer';
import { Delta } from './Delta';
import { useGameStore } from '../store/gameStore';

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
  const bubble = useGameStore(s => s.activeBubbles[player.id]);
  return (
    <div className={`player-chip${isActive ? ' player-chip--active' : ''}${isMe ? ' player-chip--me' : ''}`}>
      {bubble && (
        <div className={`chat-bubble${isMe ? '' : ' chat-bubble--below'}`} key={bubble.key}>
          {bubble.text}
        </div>
      )}
      {isActive && (phase === 'BIDDING' || phase === 'PLAYING' || phase === 'TRUMP_SELECT') && durationMs !== undefined && (
        <TurnBorder key={turnKey} durationMs={durationMs} />
      )}

      <div className="player-chip__name">
        {player.name}
        {isMe && <span className="tag-faint" style={{ marginLeft: 4 }}>(you)</span>}
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
