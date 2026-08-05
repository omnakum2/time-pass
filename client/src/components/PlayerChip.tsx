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
}

export function PlayerChip({ player, bid, tricksWon, isActive, phase, turnKey, timerMs, isMe }: Props) {
  return (
    <div className={`player-chip${isActive ? ' player-chip--active' : ''}`}>
      {isActive && (phase === 'BIDDING' || phase === 'PLAYING') && (
        <TurnBorder key={turnKey} durationMs={timerMs ?? 30_000} />
      )}

      <div className="player-chip__name">
        {player.name}
        {isMe && <span style={{ opacity: 0.5, fontSize: '0.7em', marginLeft: 4 }}>(you)</span>}
      </div>

      <div className="player-chip__stats">
        {bid !== null ? `Bid ${bid}` : (phase === 'BIDDING' ? 'bidding…' : '—')}
        {' · '}Won {tricksWon}
      </div>

      {!player.connected && (
        <div className="player-chip__disconnected">disconnected</div>
      )}
    </div>
  );
}
