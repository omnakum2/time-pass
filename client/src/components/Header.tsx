import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { GuideContent } from '../pages/GuidePage';
import { Scoreboard } from './Scoreboard';
import logo from '../assets/logo.png';

export function Header() {
  const navigate = useNavigate();
  const gameState = useGameStore((s) => s.gameState);
  const phase = gameState?.phase;
  const inGame =
    phase === 'DEALING' ||
    phase === 'BIDDING' ||
    phase === 'PLAYING' ||
    phase === 'ROUND_SCORING';
  const [guideOpen, setGuideOpen] = useState(false);
  const [scoreboardOpen, setScoreboardOpen] = useState(false);

  return (
    <>
      <header className="app-header">
        <span className="app-header__brand" onClick={() => navigate('/')}>
          <img src={logo} alt="Bid Club" className="app-header__logo" />
        </span>
        <nav className="app-header__nav">
          {!inGame && (
            <button className="app-header__link" onClick={() => navigate('/')}>
              Home
            </button>
          )}
          {inGame && (
            <button className="app-header__link" onClick={() => setScoreboardOpen(true)}>
              Scoreboard
            </button>
          )}
          <button
            className="app-header__link"
            onClick={() => (inGame ? setGuideOpen(true) : navigate('/guide'))}
          >
            Guide
          </button>
        </nav>
      </header>

      {/* ── Scoreboard overlay ─────────────────────────────────── */}
      {scoreboardOpen && gameState && (
        <div className="scoreboard-overlay" onClick={() => setScoreboardOpen(false)}>
          <div className="scoreboard-overlay__panel" onClick={(e) => e.stopPropagation()}>
            <button
              className="scoreboard-overlay__close"
              onClick={() => setScoreboardOpen(false)}
              aria-label="Close"
            >
              ✕
            </button>
            <h2 className="scoreboard-overlay__title">Scoreboard</h2>
            <p className="scoreboard-overlay__note">The game keeps running while you view scores.</p>
            <Scoreboard gameState={gameState} />
          </div>
        </div>
      )}

      {/* ── Guide overlay ──────────────────────────────────────── */}
      {guideOpen && (
        <div className="guide-overlay" onClick={() => setGuideOpen(false)}>
          <div className="guide-overlay__panel" onClick={(e) => e.stopPropagation()}>
            <button
              className="guide-overlay__close"
              onClick={() => setGuideOpen(false)}
              aria-label="Close"
            >
              ✕
            </button>
            <p className="guide-overlay__note">The game keeps running while you read.</p>
            <GuideContent />
          </div>
        </div>
      )}
    </>
  );
}
