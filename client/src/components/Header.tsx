import { useState, lazy, Suspense } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { Scoreboard } from './Scoreboard';
import { Modal } from './Modal';

// Lazy so the (bilingual) guide content isn't in the initial bundle — loaded
// only when the in-game overlay opens. The /guide route lazy-loads it too.
const GuideContent = lazy(() =>
  import('../pages/GuidePage').then((m) => ({ default: m.GuideContent }))
);
import { sendMsg } from '../net/socket';
import { storage } from '../storage';
import logo from '../assets/logo.webp';

export function Header() {
  const navigate = useNavigate();
  const gameState = useGameStore((s) => s.gameState);
  const account = useGameStore((s) => s.account);
  const phase = gameState?.phase;
  const inGame =
    phase === 'DEALING' ||
    phase === 'TRUMP_SELECT' ||
    phase === 'BIDDING' ||
    phase === 'PUSH' ||
    phase === 'PLAYING' ||
    phase === 'ROUND_SCORING';
  const [guideOpen, setGuideOpen] = useState(false);
  const [scoreboardOpen, setScoreboardOpen] = useState(false);

  const handleLeave = () => {
    if (!window.confirm('Leave the game? You will return to the home screen.')) return;
    sendMsg({ type: 'leaveRoom' });
    storage.clearSession();
    useGameStore.getState().reset();
    navigate('/');
  };

  return (
    <>
      <header className="app-header">
        <span className="app-header__brand">
          <img src={logo} alt="Bid Club" className="app-header__logo" />
        </span>
        <nav className="app-header__nav">
          {account && (
            <span className="app-header__balance" title={account.displayName}>
              <span className="app-header__coin">🪙 {account.coins}</span>
              <span className="app-header__gem">💎 {account.gems}</span>
            </span>
          )}
          {!inGame && (
            <Link className="app-header__link" to="/">
              Home
            </Link>
          )}
          {inGame && (
            <button className="app-header__link" onClick={() => setScoreboardOpen(true)}>
              Scoreboard
            </button>
          )}
          {inGame && (
            <button className="app-header__link" onClick={handleLeave}>
              Leave
            </button>
          )}
          {inGame ? (
            <button className="app-header__link" onClick={() => setGuideOpen(true)}>
              Guide
            </button>
          ) : (
            <Link className="app-header__link" to="/guide">
              Guide
            </Link>
          )}
        </nav>
      </header>

      {/* ── Scoreboard overlay ─────────────────────────────────── */}
      {gameState && (
        <Modal open={scoreboardOpen} onClose={() => setScoreboardOpen(false)} title="Scoreboard">
          <p className="scoreboard-overlay__note">The game keeps running while you view scores.</p>
          <Scoreboard gameState={gameState} />
        </Modal>
      )}

      {/* ── Guide overlay ──────────────────────────────────────── */}
      <Modal open={guideOpen} onClose={() => setGuideOpen(false)}>
        <p className="guide-overlay__note">The game keeps running while you read.</p>
        <Suspense fallback={<p className="guide-overlay__note">Loading…</p>}>
          <GuideContent />
        </Suspense>
      </Modal>
    </>
  );
}
