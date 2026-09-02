import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '../store/sessionStore';
import { useBidBaaziStore } from '../store/bidbaaziStore';
import { sendMsg } from '../net/socket';
import { StandingsTable } from '../components/StandingsTable';
import { Delta } from '../components/Delta';
import { GameOver } from '../components/GameOver';
import { Modal } from '../components/Modal';
import { BidBaaziScoreboard } from '../components/BidBaaziScoreboard';
import { Icon } from '../components/Icon';
import { useSecondsRemaining } from '../hooks/useSecondsRemaining';
import { useLeaveRoom } from '../hooks/useLeaveRoom';

export function WinnerPage() {
  const { gameOver, gameState } = useBidBaaziStore();
  const { playerId, roomClosed } = useSessionStore();
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

  // Host-only expiry countdown — seeded from the server-broadcast value and ticked
  // down locally each second for display. Hidden once the room has actually closed.
  const secsLeft = useSecondsRemaining(roomClosed ? null : (gameState?.roomExpiresInMs ?? null));

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
    <GameOver
      icon={
        <div style={{ fontSize: '4rem', lineHeight: 1 }}>
          {isWinner ? '🏆' : '🎉'}
        </div>
      }
      headline={
        isWinner
          ? 'You win!'
          : `${winnerNames.join(' & ')} win${winners.length > 1 ? '!' : 's!'}`
      }
      standings={
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
      }
      extra={
        <>
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
          {gameState && (
            <Modal open={boardOpen} onClose={() => setBoardOpen(false)} title="Scoreboard">
              <BidBaaziScoreboard gameState={gameState} />
            </Modal>
          )}
        </>
      }
      isHost={isHost}
      roomClosed={roomClosed}
      hostChanged={hostChanged}
      secsLeft={secsLeft}
      onRematch={handleRematch}
      onLeave={handleLeave}
      onBackHome={() => {
        useSessionStore.getState().reset();
        useBidBaaziStore.getState().reset();
        navigate('/', { replace: true });
      }}
    />
  );
}
