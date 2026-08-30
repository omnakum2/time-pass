import { Card, Player } from 'shared';
import { TurnBorder } from './TurnTimer';
import { ThosoCardStack } from './ThosoCardStack';
import { useGameStore } from '../store/gameStore';
import { ordinal } from '../format';

interface Props {
  player: Player;
  isMe?: boolean;
  isActive: boolean;
  /** Finishing position (1 = first out); set only once the player has finished. */
  finishedRank?: number;
  phase: 'TRANSFER' | 'PLAYING';
  /** TRANSFER: the player's face-up pile top (public). */
  pileTop?: Card | null;
  /** Whether to render the card region (pile top / count). Off for my own chip. */
  showCardRegion?: boolean;
  // Turn-timer ring (identical wiring to Bid Club)
  remainingMs?: number;
  fullMs?: number;
  startKey?: string;
  running?: boolean;
  /** Clickable as a transfer target (a source card is currently selected). */
  selectable?: boolean;
  /** Shake once — an illegal transfer was rejected by the server. */
  reject?: boolean;
  onSelect?: () => void;
}

/**
 * Thoso opponent / own player chip — reuses Bid Club's `.player-chip` shell (name,
 * active glow, turn-border ring, disconnected state) but swaps the bid/tricks line
 * for a Thoso card region: the pile top in Phase 1, a hand count in Phase 2. A
 * finished player is dimmed and badged, and skipped in the turn rotation.
 */
export function ThosoPlayerChip({
  player, isMe, isActive, finishedRank, phase, pileTop, showCardRegion,
  remainingMs, fullMs, startKey, running, selectable, reject, onSelect,
}: Props) {
  const finished = finishedRank !== undefined;
  const cls = [
    'player-chip',
    isActive && !finished ? 'player-chip--active' : '',
    isMe ? 'player-chip--me' : '',
    finished ? 'thoso-chip--finished' : '',
    selectable ? 'thoso-chip--target' : '',
    reject ? 'reject' : '',
  ].filter(Boolean).join(' ');
  const bubble = useGameStore(s => s.activeBubbles[player.id]);

  return (
    <div className={cls} onClick={selectable ? onSelect : undefined}>
      {bubble && (
        <div className={`chat-bubble${isMe ? '' : ' chat-bubble--below'}`} key={bubble.key}>
          {bubble.text}
        </div>
      )}
      {isActive && !finished && fullMs !== undefined && (
        <TurnBorder key={startKey} remainingMs={remainingMs ?? 0} fullMs={fullMs} startKey={startKey ?? ''} running={running} />
      )}

      <div className="player-chip__name">
        {player.name}
        {isMe && <span className="tag-faint" style={{ marginLeft: 4 }}>(you)</span>}
      </div>

      {showCardRegion && !finished && phase === 'TRANSFER' && (
        <div className="thoso-chip__region">
          <ThosoCardStack card={pileTop ?? null} size="sm" />
        </div>
      )}
      {/* TODO(thoso): Phase-2 (PLAYING) opponent chip shows NAME ONLY for now.
          Decide what info to surface here later (pile-pickup tally / at-risk /
          last-played card / hand count) and render it for phase === 'PLAYING'. */}

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
