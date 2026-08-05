import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { GuideContent } from '../pages/GuidePage';

export function Header() {
  const navigate = useNavigate();
  const phase = useGameStore((s) => s.gameState?.phase);
  const inGame =
    phase === 'DEALING' ||
    phase === 'BIDDING' ||
    phase === 'PLAYING' ||
    phase === 'ROUND_SCORING';
  const [guideOpen, setGuideOpen] = useState(false);

  return (
    <>
      <header className="app-header">
        <span className="app-header__brand" onClick={() => navigate('/')}>
          Jhatpat
        </span>
        <nav className="app-header__nav">
          {!inGame && (
            <button className="app-header__link" onClick={() => navigate('/')}>
              Home
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
