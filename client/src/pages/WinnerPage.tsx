import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { storage } from '../storage';
import { sendMsg } from '../net/socket';
import { StandingsTable } from '../components/StandingsTable';
import { Delta } from '../components/Delta';
import { Button } from '../components/Button';
import { Surface } from '../components/Surface';
import { STATUS_COLORS } from '../lib/helpers';

export function WinnerPage() {
  const { gameOver, playerId, gameState, reset, roomClosed } = useGameStore();
  const navigate = useNavigate();

  const isHost = gameState?.hostId === playerId;

  const hasWinners = gameOver && gameOver.winners.length > 0;

  // Host-only expiry countdown. Seeded from the server-broadcast value and
  // ticked locally each second for display.
  const [secsLeft, setSecsLeft] = useState<number | null>(null);

  useEffect(() => {
    const expiresInMs = gameState?.roomExpiresInMs;
    if (roomClosed || expiresInMs == null) {
      setSecsLeft(null);
      return;
    }

    setSecsLeft(Math.ceil(expiresInMs / 1000));
    const interval = setInterval(() => {
      setSecsLeft(prev => (prev == null ? prev : Math.max(0, prev - 1)));
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState?.roomExpiresInMs, roomClosed]);

  useEffect(() => {
    if (!hasWinners) return;

    // Party-popper: one blast from each top corner, then natural gravity fall.
    // Both sides use the exact same color mix — no left/right color separation.
    import('canvas-confetti').then(({ default: confetti }) => {
      const colors = ['#E9B84A', STATUS_COLORS.success, STATUS_COLORS.danger, '#FBF6E9'];
      const common = { particleCount: 140, spread: 55, startVelocity: 60, gravity: 1, scalar: 1.1, ticks: 220, colors };
      // Top
      confetti({ ...common, angle: 270, spread: 60, startVelocity: 32, origin: { x: 0.2, y: 0 } });  // top-left edge, falling
      confetti({ ...common, angle: 270, spread: 60, startVelocity: 32, origin: { x: 0.8, y: 0 } });  // top-right edge, falling

      // Bottom
      confetti({ ...common, angle: 45, origin: { x: 0, y: 1 } }); // bottom-left
      confetti({ ...common, angle: 135, origin: { x: 1, y: 1 } }); // bottom-right
    });
  }, [hasWinners]);

  if (!gameOver) return <div className="page"><p>Loading…</p></div>;

  const { winners, finalScores, playerNames } = gameOver;
  const hostLeft = winners.length === 0;
  const isWinner = winners.includes(playerId ?? '');

  // Sort by score descending (handles all-negative scores correctly)
  const sortedPlayers = Object.entries(finalScores)
    .sort(([, a], [, b]) => b - a)
    .map(([id, score]) => ({ id, score, name: playerNames[id] ?? id }));

  const winnerNames = winners.map(id => playerNames[id] ?? id);
  const topScore = sortedPlayers[0]?.score;

  const handleRematch = () => sendMsg({ type: 'restartGame' });
  const handleLeave = () => {
    sendMsg({ type: 'leaveRoom' }); // release our seat server-side before leaving
    storage.clearSession();
    sessionStorage.removeItem('pendingRoomId');
    sessionStorage.removeItem('pendingHost');
    navigate('/', { replace: true });
    reset();
  };

  return (
    <div className="winner-page-wrap">
      <Surface className="winner-card">

        {/* Trophy / icon */}
        <div style={{ fontSize: '4rem', lineHeight: 1 }}>
          {hostLeft ? '🚪' : isWinner ? '🏆' : '🎉'}
        </div>

        {/* Headline */}
        {hostLeft ? (
          <>
            <h1 style={{ color: 'var(--gold)', fontSize: '1.6rem' }}>Host Left</h1>
            <p style={{ opacity: 0.7, fontSize: '0.9rem' }}>Game ended early. Current standings:</p>
          </>
        ) : (
          <>
            <h1 style={{ color: 'var(--gold)', fontSize: '1.8rem' }}>
              {isWinner
                ? 'You win!'
                : `${winnerNames.join(' & ')} win${winners.length > 1 ? '!' : 's!'}`}
            </h1>
          </>
        )}

        {/* Full standings table */}
        <StandingsTable>
          <thead>
            <tr>
              <th>Player</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {sortedPlayers.map((p, i) => {
              const isTopPlayer = winners.includes(p.id);
              return (
                <tr key={p.id} style={{ background: isTopPlayer ? 'rgba(212,175,55,0.12)' : 'transparent' }}>
                  <td style={{ fontWeight: p.id === playerId ? 700 : 400 }}>
                    {p.name}
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : ''}
                    {p.id === playerId && <span style={{ opacity: 0.45, marginLeft: 5, fontSize: '0.78rem' }}>(you)</span>}
                  </td>
                  <td>
                    <Delta value={p.score} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </StandingsTable>

        {roomClosed ? (
          <>
            <p style={{ opacity: 0.7, fontSize: '0.9rem' }}>This game has ended and the room has closed.</p>
            <Button
              variant="primary"
              block
              onClick={() => { reset(); navigate('/', { replace: true }); }}
            >
              Back to Home
            </Button>
          </>
        ) : hostLeft ? (
          <Button variant="secondary" block onClick={handleLeave}>
            Leave
          </Button>
        ) : isHost ? (
          <>
            <Button variant="primary" block onClick={handleRematch}>
              Play Again
            </Button>
            {secsLeft != null && (
              <p style={{ opacity: 0.6, fontSize: '0.8rem', margin: 0 }}>Room closes in {secsLeft}s</p>
            )}
            <Button variant="secondary" block onClick={handleLeave}>
              Leave
            </Button>
          </>
        ) : (
          <>
            <p style={{ opacity: 0.7, fontSize: '0.9rem' }}>Waiting for the host to start a rematch…</p>
            <Button variant="secondary" block onClick={handleLeave}>
              Leave
            </Button>
          </>
        )}
      </Surface>
    </div>
  );
}
