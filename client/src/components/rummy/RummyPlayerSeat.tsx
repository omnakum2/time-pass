import { Player } from 'shared';
import { TurnBorder } from '../TurnTimer';

interface Props {
  player: Player;
  handCount: number;
  rank: number | null;
  isActive: boolean;
  isMe?: boolean;
  remainingMs?: number;
  fullMs?: number;
  startKey?: string;
  expiresAt?: number | null;
}

export function RummyPlayerSeat({ player, handCount, rank, isActive, isMe, remainingMs, fullMs, startKey, expiresAt }: Props) {
  return (
    <div className={`player-chip${isActive ? ' player-chip--active' : ''}${isMe ? ' player-chip--me' : ''}`}>
      {isActive && fullMs !== undefined && (
        <TurnBorder
          key={startKey}
          remainingMs={remainingMs ?? 0}
          fullMs={fullMs}
          startKey={startKey ?? ''}
          expiresAt={expiresAt}
        />
      )}
      <div className="player-chip__name">
        {player.name}
        {isMe && <span className="tag-faint" style={{ marginLeft: 4 }}>(you)</span>}
      </div>
      <div className="player-chip__stats">
        {rank != null ? `Rank ${rank}` : `${handCount} card${handCount === 1 ? '' : 's'}`}
      </div>
      {player.status !== 'online' && (
        <div className="player-chip__disconnected">
          {player.status === 'reconnecting' ? 'reconnecting…' : 'disconnected'}
        </div>
      )}
    </div>
  );
}
