import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { sendMsg } from '../net/socket';
import { StandingsTable } from '../components/StandingsTable';
import { Delta } from '../components/Delta';
import { Button } from '../components/Button';
import { Surface } from '../components/Surface';
import { Modal } from '../components/Modal';
import { Scoreboard } from '../components/Scoreboard';
import { Icon } from '../components/Icon';
import { fireWinnerConfetti } from '../confetti';
import { useSecondsRemaining } from '../hooks/useSecondsRemaining';
import { useLeaveRoom } from '../hooks/useLeaveRoom';

export function WinnerPage() {
  const { gameOver, playerId, gameState, reset, roomClosed } = useGameStore();
  const navigate = useNavigate();
  const leaveRoom = useLeaveRoom();
  const [boardOpen, setBoardOpen] = useState(false);

  const isHost = gameState?.hostId === playerId;

  // Track the first real host we ever see on this screen. If the host leaves a
  // finished game, the server promotes another player and broadcasts a new
  // hostId — we compare against this to detect that mid-screen change.
  const currentHostId = gameState?.hostId;
  const initialHostIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (initialHostIdRef.current == null && currentHostId) {
      initialHostIdRef.current = currentHostId;
    }
  }, [currentHostId]);
  const initialHostId = initialHostIdRef.current;
  const hostChanged = initialHostId != null && currentHostId !== initialHostId;

  const hasWinners = gameOver && gameOver.winners.length > 0;

  // Host-only expiry countdown — seeded from the server-broadcast value and ticked
  // down locally each second for display. Hidden once the room has actually closed.
  const secsLeft = useSecondsRemaining(roomClosed ? null : (gameState?.roomExpiresInMs ?? null));

  // Winner celebration — an energetic, two-burst confetti pop for EVERYONE at game
  // over (win or lose). Skipped for viewers who prefer reduced motion.
  useEffect(() => {
    if (!hasWinners) return;
    fireWinnerConfetti();
  }, [hasWinners]);

  if (!gameOver) return <div className="page"><p>Loading…</p></div>;

  const { winners, finalScores, playerNames } = gameOver;
  const isWinner = winners.includes(playerId ?? '');

  // Sort by score descending (handles all-negative scores correctly)
  const sortedPlayers = Object.entries(finalScores)
    .sort(([, a], [, b]) => b - a)
    .map(([id, score]) => ({ id, score, name: playerNames[id] ?? id }));

  const winnerNames = winners.map(id => playerNames[id] ?? id);
  const topScore = sortedPlayers[0]?.score;

  const handleRematch = () => sendMsg({ type: 'restartGame' });
  const handleLeave = leaveRoom;

  return (
    <div className="winner-page-wrap">
      <Surface className="winner-card">

        {/* Trophy / icon */}
        <div style={{ fontSize: '4rem', lineHeight: 1 }}>
          {isWinner ? '🏆' : '🎉'}
        </div>

        {/* Headline */}
        <h1 className="card-title card-title--lg">
          {isWinner
            ? 'You win!'
            : `${winnerNames.join(' & ')} win${winners.length > 1 ? '!' : 's!'}`}
        </h1>

        {/* Full standings table */}
        <StandingsTable variant="lr">
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
                <tr key={p.id} className={isTopPlayer ? 'row-highlight' : undefined}>
                  <td className={p.id === playerId ? 'cell-me' : undefined}>
                    {p.name}
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : ''}
                    {p.id === playerId && <span className="tag-faint" style={{ marginLeft: 5 }}>(you)</span>}
                  </td>
                  <td>
                    <Delta value={p.score} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </StandingsTable>

        {gameState && (
          <button
            type="button"
            className="winner-board-btn"
            onClick={() => setBoardOpen(true)}
            title="View full scoreboard"
          >
            <Icon name="table" size={15} />
            Full scoreboard
          </button>
        )}

        {roomClosed ? (
          <>
            <p className="hint">This game has ended and the room has closed.</p>
            <Button
              variant="primary"
              block
              onClick={() => { reset(); navigate('/', { replace: true }); }}
            >
              Back to Home
            </Button>
          </>
        ) : isHost ? (
          <>
            {hostChanged && (
              <p className="hint">The previous host left, so you're the host now.</p>
            )}
            {secsLeft != null && (
              <p className="tag-faint" style={{ margin: 0 }}>Room closes in {secsLeft}s</p>
            )}
            <Button variant="primary" block onClick={handleRematch}>
              Play Again
            </Button>
            <Button variant="secondary" block onClick={handleLeave}>
              Leave
            </Button>
          </>
        ) : (
          <>
            <p className="hint">Waiting for the host to start a rematch…</p>
            <Button variant="secondary" block onClick={handleLeave}>
              Leave
            </Button>
          </>
        )}
      </Surface>

      {gameState && (
        <Modal open={boardOpen} onClose={() => setBoardOpen(false)} title="Scoreboard">
          <Scoreboard gameState={gameState} />
        </Modal>
      )}
    </div>
  );
}
