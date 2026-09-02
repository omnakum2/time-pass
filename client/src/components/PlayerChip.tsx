import React from 'react';
import { Player } from 'shared';
import { TurnBorder } from './TurnTimer';
import { useSessionStore } from '../store/sessionStore';
import { ordinal } from '../format';

interface Props {
  player: Player;
  isMe?: boolean;
  isActive: boolean;
  /** Caller computes the game-specific phase condition for showing the turn ring. */
  showTimer?: boolean;
  remainingMs?: number;
  fullMs?: number;
  startKey?: string;
  running?: boolean;
  /** Game-specific middle content (BidBaazi stats/total, Thoso card region). */
  info?: React.ReactNode;
  /** Finishing position (1 = first out); set only once the player has finished (Thoso). */
  finishedRank?: number;
  /** Small pill shown while a finished round is held (e.g. 'Leads' / 'Picks up') (Thoso). */
  roundBadge?: string;
  /** Clickable as a transfer target (a source card is currently selected) (Thoso). */
  selectable?: boolean;
  /** Shake once — an illegal transfer was rejected by the server (Thoso). */
  reject?: boolean;
  onSelect?: () => void;
}

/**
 * Shared player-chip shell for every game: chat bubble, active glow, turn-border ring,
 * name, disconnected state, plus optional finished/round-winner/transfer-target features.
 * Each game passes its own middle content through the `info` slot.
 */
export function PlayerChip({
  player, isMe, isActive, showTimer, remainingMs, fullMs, startKey, running,
  info, finishedRank, roundBadge, selectable, reject, onSelect,
}: Props) {
  const bubble = useSessionStore(s => s.activeBubbles[player.id]);
  const finished = finishedRank !== undefined;
  const cls = [
    'player-chip',
    isActive && !finished ? 'player-chip--active' : '',
    isMe ? 'player-chip--me' : '',
    finished ? 'thoso-chip--finished' : '',
    selectable ? 'thoso-chip--target' : '',
    reject ? 'reject' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={cls} onClick={selectable ? onSelect : undefined}>
      {bubble && (
        <div className={`chat-bubble${isMe ? '' : ' chat-bubble--below'}`} key={bubble.key}>
          {bubble.text}
        </div>
      )}
      {showTimer && fullMs !== undefined && (
        <TurnBorder key={startKey} remainingMs={remainingMs ?? 0} fullMs={fullMs} startKey={startKey ?? ''} running={running} />
      )}

      <div className="player-chip__name">
        {player.name}
        {isMe && <span className="tag-faint" style={{ marginLeft: 4 }}>(you)</span>}
      </div>

      {roundBadge && !finished && (
        <div className="thoso-chip__round-badge">{roundBadge}</div>
      )}

      {info}

      {finished && (
        <div className="thoso-chip__finished-badge">Finished · {ordinal(finishedRank!)}</div>
      )}

      {player.status !== 'online' && !finished && (
        <div className="player-chip__disconnected">
          {player.status === 'reconnecting' ? 'reconnecting…' : 'left'}
        </div>
      )}
    </div>
  );
}
