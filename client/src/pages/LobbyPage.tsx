import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { storage } from '../storage';
import { STORAGE_KEYS, COPY_FEEDBACK_MS } from '../constants';
import { useSecondsRemaining } from '../hooks/useSecondsRemaining';
import { sendMsg } from '../net/socket';
import { Surface } from '../components/Surface';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { RoomSettings } from '../components/RoomSettings';
import { GAME_MODES } from 'shared';

export function LobbyPage() {
  const { roomId: urlRoomId } = useParams<{ roomId: string }>();
  const { gameState, playerId, roomId, connected, reconnectFailed } = useGameStore();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  // If someone navigates directly to /room/:id without being in a room,
  // show a join prompt via the home page logic
  useEffect(() => {
    if (roomId || !urlRoomId || !connected) return;
    // If we already hold a session for THIS room, an auto-reconnect is in flight — wait
    // for it instead of bouncing to the join prompt (unless that reconnect just failed).
    const session = storage.getSession();
    const mineForThisRoom = session?.roomId?.toUpperCase() === urlRoomId.toUpperCase();
    if (mineForThisRoom && !reconnectFailed) return;
    // Genuine newcomer (or the reconnect failed): go home with the code (and host) pre-filled.
    const host = new URLSearchParams(window.location.search).get('host');
    sessionStorage.setItem(STORAGE_KEYS.pendingRoomId, urlRoomId);
    if (host) sessionStorage.setItem(STORAGE_KEYS.pendingHost, host);
    navigate('/', { replace: true });
  }, [roomId, urlRoomId, connected, reconnectFailed, navigate]);

  // Locally tick down the countdown coming from the server.
  const countdownMs = gameState?.countdownMs ?? null;
  const secondsLeft = useSecondsRemaining(countdownMs);

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
  const hostName = players.find(p => p.id === hostId)?.name ?? '';
  const displayRoomId = roomId ?? urlRoomId ?? '';
  const joinUrl = `${window.location.origin}/room/${displayRoomId}?host=${encodeURIComponent(hostName)}`;

  // The invite link only works for other people if the app is being served from a
  // routable address. On localhost the link points at the recipient's own machine.
  const onLocalhost = /^(localhost|127\.0\.0\.1|\[?::1\]?)$/.test(window.location.hostname);

  const markCopied = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
  };

  const copyUrl = async () => {
    // Preferred path: async Clipboard API — but it only exists in a secure context
    // (https or http://localhost), so it's undefined when hosting over http://<LAN-IP>.
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(joinUrl);
        markCopied();
        return;
      }
    } catch {
      /* fall through to the legacy path below */
    }
    // Fallback for non-secure origins: hidden textarea + execCommand('copy').
    try {
      const ta = document.createElement('textarea');
      ta.value = joinUrl;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, ta.value.length);
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if (ok) markCopied();
    } catch {
      /* clipboard genuinely unavailable — the user can still select the code manually */
    }
  };

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
              onClick={copyUrl}
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
