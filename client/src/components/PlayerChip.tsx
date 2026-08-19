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
  remainingMs?: number;
  fullMs?: number;
  startKey?: string;
  running?: boolean;
  isMe?: boolean;
  totalScore?: number;
  pushChoice?: 'locked' | 'pushed';
}

export function PlayerChip({ player, bid, tricksWon, isActive, phase, remainingMs, fullMs, startKey, running, isMe, totalScore, pushChoice }: Props) {
  const bubble = useGameStore(s => s.activeBubbles[player.id]);
  return (
    <div className={`player-chip${isActive ? ' player-chip--active' : ''}${isMe ? ' player-chip--me' : ''}`}>
      {bubble && (
        <div className={`chat-bubble${isMe ? '' : ' chat-bubble--below'}`} key={bubble.key}>
          {bubble.text}
        </div>
      )}
      {isActive && fullMs !== undefined &&
        (phase === 'PLAYING' || ((phase === 'BIDDING' || phase === 'TRUMP_SELECT') && !isMe)) && (
        <TurnBorder key={startKey} remainingMs={remainingMs ?? 0} fullMs={fullMs} startKey={startKey ?? ''} running={running} />
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
          {(phase === 'PUSH' || pushChoice) && (
            <>
              {' · '}
              <span
                className={`player-chip__push${pushChoice ? '' : ' player-chip__push--deciding'}`}
                title={pushChoice === 'locked' ? 'Locked ×2' : pushChoice === 'pushed' ? 'Pushed ×3' : 'Deciding'}
              >
                {pushChoice === 'locked' ? '×2' : pushChoice === 'pushed' ? '×3' : '?'}
              </span>
            </>
          )}
        </div>
      )}

      {player.status !== 'online' && (
        <div className="player-chip__disconnected">
          {player.status === 'reconnecting' ? 'reconnecting…' : 'disconnected'}
        </div>
      )}
    </div>
  );
}
