import { useState, lazy, Suspense } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { useThosoStore } from '../store/thosoStore';
import { Scoreboard } from './Scoreboard';
import { ThosoStandings } from './ThosoStandings';
import { ThosoGuide } from './ThosoGuide';
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
  const location = useLocation();
  const gameState = useGameStore((s) => s.gameState);
  const thosoState = useThosoStore((s) => s.state);
  const phase = gameState?.phase;
  const thosoPhase = thosoState?.phase;
  const inGame =
    phase === 'DEALING' ||
    phase === 'TRUMP_SELECT' ||
    phase === 'BIDDING' ||
    phase === 'PUSH' ||
    phase === 'PLAYING' ||
    phase === 'ROUND_SCORING' ||
    thosoPhase === 'TRANSFER' ||
    thosoPhase === 'PLAYING' ||
    thosoPhase === 'GAME_OVER';
  const [guideOpen, setGuideOpen] = useState(false);
  const [scoreboardOpen, setScoreboardOpen] = useState(false);

  const isLoungeHome = location.pathname === '/';
  const seg = location.pathname.split('/')[1] ?? '';
  // Current game id (bid-club / thoso / …) — the switch point for the
  // game-specific Guide and Scoreboard overlays below.
  const gameId = seg;

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
        <Link to="/" className="app-header__brand" title="Bid Club Lounge">
          <img src={logo} alt="Bid Club" className="app-header__logo" />
        </Link>
        <nav className="app-header__nav">
          {!inGame && !isLoungeHome && (
            <Link className="app-header__link" to="/">
              Lounge
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
          ) : seg === 'bid-club' ? (
            <Link className="app-header__link" to={`/${seg}/guide`}>
              Guide
            </Link>
          ) : null}
        </nav>
      </header>

      {/* ── Scoreboard overlay (game-specific) ─────────────────── */}
      {(gameState || (gameId === 'thoso' && thosoState)) && (
        <Modal open={scoreboardOpen} onClose={() => setScoreboardOpen(false)} title="Scoreboard">
          <p className="scoreboard-overlay__note">The game keeps running while you view scores.</p>
          {gameId === 'thoso' && thosoState ? (
            <ThosoStandings state={thosoState} />
          ) : (
            gameState && <Scoreboard gameState={gameState} />
          )}
        </Modal>
      )}

      {/* ── Guide overlay (game-specific) ──────────────────────── */}
      <Modal open={guideOpen} onClose={() => setGuideOpen(false)}>
        <p className="guide-overlay__note">The game keeps running while you read.</p>
        <Suspense fallback={<p className="guide-overlay__note">Loading…</p>}>
          {gameId === 'thoso' ? <ThosoGuide /> : <GuideContent />}
        </Suspense>
      </Modal>
    </>
  );
}
