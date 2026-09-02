import type { ReactNode } from 'react';
import type { Player } from 'shared';
import { useSecondsRemaining } from '../hooks/useSecondsRemaining';
import { useCopyInvite } from '../hooks/useCopyInvite';
import { Surface } from './Surface';
import { Button } from './Button';
import { Icon } from './Icon';

interface LobbyProps {
  players: Player[];
  hostId: string;
  playerId: string;
  maxPlayers: number;
  displayRoomId: string;
  joinUrl: string;
  countdownMs: number | null;
  isHost: boolean;
  onStart: () => void;
  /** Host settings slot (RoomSettings) — shown only when isHost. */
  settings?: ReactNode;
  /** Optional badge under the title (e.g. BidBaazi mode badge). */
  badge?: ReactNode;
  /** Optional non-host line (BidBaazi shows mode+count); default = players count. */
  nonHostInfo?: ReactNode;
}

/** Shared waiting-room shell used by every game's lobby. */
export function Lobby({
  players,
  hostId,
  playerId,
  maxPlayers,
  displayRoomId,
  joinUrl,
  countdownMs,
  isHost,
  onStart,
  settings,
  badge,
  nonHostInfo,
}: LobbyProps) {
  const { copied, copy } = useCopyInvite(joinUrl);
  const secondsLeft = useSecondsRemaining(countdownMs);

  return (
    <Surface className="lobby flex-col gap-lg">
      <div className="text-center">
        <h2 className="card-title card-title--md">Waiting Room</h2>
        {badge}
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <span style={{ fontSize: '1.3rem', fontWeight: 700, letterSpacing: 3 }}>
            {displayRoomId}
          </span>
          <button
            className="icon-btn"
            onClick={copy}
            title="Copy invite link"
            aria-label="Copy invite link"
          >
            {copied ? <Icon name="check" /> : <Icon name="copy" />}
          </button>
        </div>
        <p className="tag-faint" style={{ marginTop: 4 }}>
          Share this code or link for others to join
        </p>
      </div>

      {isHost ? (
        settings
      ) : (
        nonHostInfo ?? (
          <p className="text-center muted">
            Players: {players.length} / {maxPlayers}
          </p>
        )
      )}

      <div className="flex-col gap-sm">
        <p className="hint">
          Players ({players.length}/{maxPlayers})
        </p>
        <ul className="player-list flex-col gap-sm">
          {players.map(p => (
            <li key={p.id}>
              <span>{p.name}</span>
              {p.id === hostId && <span className="host-badge">HOST</span>}
              {p.id === playerId && <span className="tag-faint">(you)</span>}
              {p.status === 'reconnecting' && <span className="tag-faint">reconnecting…</span>}
              {p.status === 'offline' && <span className="tag-faint">disconnected</span>}
            </li>
          ))}
        </ul>
      </div>

      {countdownMs != null ? (
        <p className="card-title card-title--sm">
          Starting in {secondsLeft ?? 0}…
        </p>
      ) : (
        <p className="text-center muted">
          Waiting for players ({players.length}/{maxPlayers})
        </p>
      )}

      {isHost && (
        <Button
          variant="primary"
          block
          onClick={onStart}
          disabled={players.length < 2}
        >
          Start Game
        </Button>
      )}
    </Surface>
  );
}
