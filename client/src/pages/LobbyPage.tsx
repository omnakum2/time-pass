import { useParams } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { storage } from '../storage';
import { useSecondsRemaining } from '../hooks/useSecondsRemaining';
import { useCopyInvite } from '../hooks/useCopyInvite';
import { useJoinViaLinkRedirect } from '../hooks/useJoinViaLinkRedirect';
import { sendMsg } from '../net/socket';
import { Surface } from '../components/Surface';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { RoomSettings } from '../components/RoomSettings';
import { GAME_MODES } from 'shared';

export function LobbyPage() {
  const { roomId: urlRoomId, game = 'bid-club' } = useParams<{ roomId: string; game: string }>();
  const { gameState, playerId, roomId, reconnectFailed } = useGameStore();

  // Someone landing directly on /:game/room/:id without being in the room → stash the
  // code and bounce home to enter a name + join (waits out an in-flight reconnect).
  useJoinViaLinkRedirect(game, urlRoomId);

  // Locally tick down the countdown coming from the server.
  const countdownMs = gameState?.countdownMs ?? null;
  const secondsLeft = useSecondsRemaining(countdownMs);

  // Invite link (null-safe so the copy hook can run before the loading early-return).
  const displayRoomId = roomId ?? urlRoomId ?? '';
  const hostName = gameState ? (gameState.players.find(p => p.id === gameState.hostId)?.name ?? '') : '';
  const joinUrl = `${window.location.origin}/${game}/room/${displayRoomId}?host=${encodeURIComponent(hostName)}`;
  const { copied, copy } = useCopyInvite(joinUrl);

  if (!gameState || !playerId) {
    const s = storage.getSession();
    const reconnectingHere = !reconnectFailed && s?.roomId?.toUpperCase() === urlRoomId?.toUpperCase();
    return (
      <div className="page">
        <p>{reconnectingHere ? 'Reconnecting…' : 'Joining room…'}</p>
      </div>
    );
  }

  const { players, hostId } = gameState;
  const isHost = hostId === playerId;

  // The invite link only works for other people if the app is being served from a
  // routable address. On localhost the link points at the recipient's own machine.
  const onLocalhost = /^(localhost|127\.0\.0\.1|\[?::1\]?)$/.test(window.location.hostname);

  return (
    <div className="page">
      <Surface className="lobby flex-col gap-lg">
        <div className="text-center">
          <h2 className="card-title card-title--md">Waiting Room</h2>
          {(() => {
            const modeLabel = GAME_MODES.find(m => m.id === gameState.mode)?.label ?? '';
            return modeLabel ? (
              <div style={{ marginTop: 6 }}>
                <span className="mode-badge">{modeLabel}</span>
              </div>
            ) : null;
          })()}
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
          <RoomSettings
            maxPlayers={gameState.maxPlayers}
            minPlayers={Math.max(2, players.length)}
            mode={gameState.mode}
            onCommitMaxPlayers={(n) => sendMsg({ type: 'updateRoomSettings', maxPlayers: n })}
            onSelectMode={(m) => sendMsg({ type: 'updateRoomSettings', mode: m })}
          />
        ) : (
          <p className="text-center muted">
            {GAME_MODES.find(m => m.id === gameState.mode)?.label ?? ''} · Players: {players.length} / {gameState.maxPlayers}
          </p>
        )}

        <div className="flex-col gap-sm">
          <p className="hint">
            Players ({players.length}/{gameState.maxPlayers})
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
            Waiting for players ({players.length}/{gameState.maxPlayers})
          </p>
        )}

        {isHost && (
          <Button
            variant="primary"
            block
            onClick={() => sendMsg({ type: 'startGame' })}
            disabled={players.length < 2}
          >
            Start Game
          </Button>
        )}
      </Surface>
    </div>
  );
}
