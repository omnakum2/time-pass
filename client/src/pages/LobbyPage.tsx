import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { sendMsg } from '../net/socket';

export function LobbyPage() {
  const { roomId: urlRoomId } = useParams<{ roomId: string }>();
  const { gameState, playerId, roomId, connected } = useGameStore();
  const navigate = useNavigate();

  // If someone navigates directly to /room/:id without being in a room,
  // show a join prompt via the home page logic
  useEffect(() => {
    if (!roomId && urlRoomId && connected) {
      // No session: redirect to home with the room code pre-filled
      // We store the intent in sessionStorage
      sessionStorage.setItem('pendingRoomId', urlRoomId);
      navigate('/', { replace: true });
    }
  }, [roomId, urlRoomId, connected, navigate]);

  if (!gameState || !playerId) {
    return (
      <div className="page">
        <p>Joining room…</p>
      </div>
    );
  }

  const { players, hostId } = gameState;
  const isHost = playerId === hostId;
  const displayRoomId = roomId ?? urlRoomId ?? '';
  const joinUrl = `${window.location.origin}/room/${displayRoomId}`;

  const copyUrl = () => {
    navigator.clipboard.writeText(joinUrl).catch(() => {});
  };

  const startGame = () => {
    sendMsg({ type: 'startGame' });
  };

  return (
    <div className="page">
      <div className="panel lobby flex-col gap-lg">
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ color: 'var(--gold)', fontSize: '1.5rem' }}>Waiting Room</h2>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span style={{ fontSize: '1.3rem', fontWeight: 700, letterSpacing: 3 }}>
              {displayRoomId}
            </span>
            <button className="btn btn--secondary btn--sm" onClick={copyUrl}>
              Copy link
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

        {isHost ? (
          <div className="flex-col gap-sm">
            <button
              className="btn btn--primary"
              onClick={startGame}
              disabled={players.length < 2}
            >
              Start Game
            </button>
            {players.length < 2 && (
              <p style={{ opacity: 0.6, fontSize: '0.8rem', textAlign: 'center' }}>
                Need at least 2 players
              </p>
            )}
          </div>
        ) : (
          <p style={{ textAlign: 'center', opacity: 0.6 }}>
            Waiting for host to start…
          </p>
        )}
      </div>
    </div>
  );
}
