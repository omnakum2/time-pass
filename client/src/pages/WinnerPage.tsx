import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { useGameStore } from '../store/gameStore';
import { storage } from '../storage';
import { disconnect, connect } from '../net/socket';

export function WinnerPage() {
  const { gameOver, playerId, reset } = useGameStore();
  const navigate = useNavigate();

  const hasWinners = gameOver && gameOver.winners.length > 0;

  useEffect(() => {
    if (!hasWinners) return;

    const end = Date.now() + 4000;
    const frame = () => {
      confetti({ particleCount: 4, angle: 60,  spread: 60, origin: { x: 0, y: 0.6 }, colors: ['#d4af37','#fff','#2ecc71'] });
      confetti({ particleCount: 4, angle: 120, spread: 60, origin: { x: 1, y: 0.6 }, colors: ['#d4af37','#fff','#e74c3c'] });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
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

  const handlePlayAgain = () => {
    storage.clearSession();
    reset();
    disconnect();
    setTimeout(() => { connect(); navigate('/', { replace: true }); }, 300);
  };

  return (
    <div className="winner-page-wrap">
      <div className="winner-card">

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
                ? 'You Win!'
                : `${winnerNames.join(' & ')} Win${winners.length > 1 ? '!' : 's!'}`}
            </h1>
            {/* Centered winner highlight card */}
            <div style={{
              background: 'rgba(212,175,55,0.15)',
              border: '2px solid var(--gold)',
              borderRadius: 14,
              padding: '14px 28px',
              textAlign: 'center',
            }}>
              <div style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--gold)' }}>
                {winnerNames.join(' & ')}
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 700, marginTop: 4 }}>
                {topScore}
              </div>
              <div style={{ opacity: 0.6, fontSize: '0.8rem' }}>Final Score</div>
            </div>
          </>
        )}

        {/* Full standings table */}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '6px 12px', opacity: 0.6, fontWeight: 600 }}>#</th>
              <th style={{ textAlign: 'left', padding: '6px 12px', opacity: 0.6, fontWeight: 600 }}>Player</th>
              <th style={{ textAlign: 'right', padding: '6px 12px', opacity: 0.6, fontWeight: 600 }}>Score</th>
            </tr>
          </thead>
          <tbody>
            {sortedPlayers.map((p, i) => {
              const isTopPlayer = winners.includes(p.id);
              return (
                <tr key={p.id} style={{ background: isTopPlayer ? 'rgba(212,175,55,0.12)' : 'transparent' }}>
                  <td style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                  </td>
                  <td style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', fontWeight: p.id === playerId ? 700 : 400 }}>
                    {p.name}
                    {p.id === playerId && <span style={{ opacity: 0.45, marginLeft: 5, fontSize: '0.78rem' }}>(you)</span>}
                  </td>
                  <td style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'right', fontWeight: 700, color: p.score >= 0 ? '#4caf50' : '#ef5350' }}>
                    {p.score}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <button className="btn btn--primary" style={{ width: '100%' }} onClick={handlePlayAgain}>
          Play Again
        </button>
      </div>
    </div>
  );
}
