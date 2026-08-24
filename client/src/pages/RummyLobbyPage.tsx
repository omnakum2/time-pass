import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { useRummyStore } from '../store/rummyStore';
import { storage } from '../storage';
import { STORAGE_KEYS, COPY_FEEDBACK_MS } from '../constants';
import { useSecondsRemaining } from '../hooks/useSecondsRemaining';
import { Surface } from '../components/Surface';
import { Icon } from '../components/Icon';

export function RummyLobbyPage() {
  const { roomId: urlRoomId } = useParams<{ roomId: string }>();
  const { playerId, roomId, connected, reconnectFailed } = useGameStore();
  const gameState = useRummyStore(s => s.gameState);
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (roomId || !urlRoomId || !connected) return;
    const session = storage.getSession();
    const mineForThisRoom = session?.roomId?.toUpperCase() === urlRoomId.toUpperCase();
    if (mineForThisRoom && !reconnectFailed) return;
    const host = new URLSearchParams(window.location.search).get('host');
    sessionStorage.setItem(STORAGE_KEYS.pendingRoomId, urlRoomId);
    if (host) sessionStorage.setItem(STORAGE_KEYS.pendingHost, host);
    navigate('/rummy', { replace: true });
  }, [roomId, urlRoomId, connected, reconnectFailed, navigate]);

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
  const hostName = players.find(p => p.id === hostId)?.name ?? '';
  const displayRoomId = roomId ?? urlRoomId ?? '';
  const joinUrl = `${window.location.origin}/rummy/room/${displayRoomId}?host=${encodeURIComponent(hostName)}`;

  const markCopied = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
  };

  const copyUrl = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(joinUrl);
        markCopied();
        return;
      }
    } catch {
      /* fall through to the legacy path below */
    }
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
      </Surface>
    </div>
  );
}
