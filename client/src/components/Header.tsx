import { useState, Suspense } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { GAMES } from 'shared';
import { useGameStore } from '../store/gameStore';
import { useThosoStore } from '../store/thosoStore';
import { Modal } from './Modal';
import { GAME_COMPONENTS } from '../games';
// Fallback guide for a game with no registry entry (defensive — in-game routes are
// always a known game). GuideContent is the platform-default (Bid Club) guide.
import { GuideContent } from '../pages/GuidePage';
import { useLeaveRoom } from '../hooks/useLeaveRoom';
import logo from '../assets/logo.webp';

export function Header() {
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
  // Current game id (bid-club / thoso / …) — the key into the component registry
  // for the game-specific Guide and Scoreboard overlays below.
  const gameId = seg;
  // Registry-driven overlay bodies (both read their own store): the scoreboard
  // standings for this game, and its guide (falling back to the default guide).
  const Standings = GAME_COMPONENTS[gameId]?.Standings;
  const Guide = GAME_COMPONENTS[gameId]?.Guide ?? GuideContent;

  const leave = useLeaveRoom();
  const handleLeave = () => {
    if (!window.confirm('Leave the game? You will return to the home screen.')) return;
    leave();
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
          ) : GAMES.find((g) => g.id === seg)?.hasGuide ? (
            <Link className="app-header__link" to={`/${seg}/guide`}>
              Guide
            </Link>
          ) : null}
        </nav>
      </header>

      {/* ── Scoreboard overlay (registry-driven) ───────────────── */}
      {(!!gameState || !!thosoState) && (
        <Modal open={scoreboardOpen} onClose={() => setScoreboardOpen(false)} title="Scoreboard">
          <p className="scoreboard-overlay__note">The game keeps running while you view scores.</p>
          {Standings && <Standings />}
        </Modal>
      )}

      {/* ── Guide overlay (registry-driven) ────────────────────── */}
      <Modal open={guideOpen} onClose={() => setGuideOpen(false)}>
        <p className="guide-overlay__note">The game keeps running while you read.</p>
        <Suspense fallback={<p className="guide-overlay__note">Loading…</p>}>
          <Guide />
        </Suspense>
      </Modal>
    </>
  );
}
