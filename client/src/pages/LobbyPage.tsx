import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';

export function LobbyPage() {
  const { roomId: urlRoomId } = useParams<{ roomId: string }>();
  const { gameState, playerId, roomId, connected } = useGameStore();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  // If someone navigates directly to /room/:id without being in a room,
  // show a join prompt via the home page logic
  useEffect(() => {
    if (!roomId && urlRoomId && connected) {
      // No session: redirect to home with the room code (and host) pre-filled.
      // We store the intent in sessionStorage.
      const host = new URLSearchParams(window.location.search).get('host');
      if (host) {
        sessionStorage.setItem('pendingRoomId', urlRoomId);
        sessionStorage.setItem('pendingHost', host);
      }
      navigate('/', { replace: true });
    }
  }, [roomId, urlRoomId, connected, navigate]);

  // Locally tick down the countdown coming from the server.
  const countdownMs = gameState?.countdownMs ?? null;
  useEffect(() => {
    if (countdownMs == null) {
      setSecondsLeft(null);
      return;
    }
    setSecondsLeft(Math.ceil(countdownMs / 1000));
    const id = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev == null) return null;
        return prev > 0 ? prev - 1 : 0;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [countdownMs]);

  if (!gameState || !playerId) {
    return (
      <div className="page">
        <p>Joining room…</p>
      </div>
    );
  }

  const { players, hostId } = gameState;
  const hostName = players.find(p => p.id === hostId)?.name ?? '';
  const displayRoomId = roomId ?? urlRoomId ?? '';
  const joinUrl = `${window.location.origin}/room/${displayRoomId}?host=${encodeURIComponent(hostName)}`;

  // The invite link only works for other people if the app is being served from a
  // routable address. On localhost the link points at the recipient's own machine.
  const onLocalhost = /^(localhost|127\.0\.0\.1|\[?::1\]?)$/.test(window.location.hostname);

  const markCopied = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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

  const copySvg = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );

  const checkSvg = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );

  return (
    <div className="page">
      <div className="panel lobby flex-col gap-lg">
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ color: 'var(--gold)', fontSize: '1.5rem' }}>Waiting Room</h2>
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
              {copied ? checkSvg : copySvg}
            </button>
          </div>
          <p style={{ opacity: 0.6, fontSize: '0.8rem', marginTop: 4 }}>
            Share this code or link for others to join
          </p>
        </div>

        <div className="flex-col gap-sm">
          <p style={{ opacity: 0.7, fontSize: '0.85rem' }}>
            Players ({players.length}/{gameState.maxPlayers})
          </p>
          <ul className="player-list flex-col gap-sm">
            {players.map(p => (
              <li key={p.id}>
                <span>{p.name}</span>
                {p.id === hostId && <span className="host-badge">HOST</span>}
                {p.id === playerId && <span style={{ opacity: 0.5, fontSize: '0.75rem' }}>(you)</span>}
                {!p.connected && <span style={{ opacity: 0.4, fontSize: '0.75rem' }}>disconnected</span>}
              </li>
            ))}
          </ul>
        </div>

        {countdownMs != null ? (
          <p style={{ textAlign: 'center', color: 'var(--gold)', fontWeight: 700, fontSize: '1.1rem' }}>
            Starting in {secondsLeft ?? 0}…
          </p>
        ) : (
          <p style={{ textAlign: 'center', opacity: 0.7 }}>
            Waiting for players ({players.length}/{gameState.maxPlayers})
          </p>
        )}
      </div>
    </div>
  );
}
