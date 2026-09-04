import { useState, Suspense } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { GAMES } from 'shared';
import { useInGame, useActiveGameId } from '../store/activeGame';
import { Modal } from './Modal';
import { GAME_DESCRIPTORS } from '../games';
// Fallback guide for a game with no registry entry (defensive — in-game routes are
// always a known game). BidBaaziGuide is the platform-default guide.
import { BidBaaziGuide } from './BidBaaziGuide';
import { useLeaveRoom } from '../hooks/useLeaveRoom';
import logo from '../assets/logo.webp';

export function Header() {
  const location = useLocation();
  // Registry-driven in-game detection (activeGame.ts lists the game stores + their
  // in-game phases) — one place to extend when a new game is added.
  const inGame = useInGame();
  const activeGameId = useActiveGameId();
  const [guideOpen, setGuideOpen] = useState(false);
  const [scoreboardOpen, setScoreboardOpen] = useState(false);

  const isLoungeHome = location.pathname === '/';
  const seg = location.pathname.split('/')[1] ?? '';
  // Current game id (bidbaazi / thoso / …) — the key into the component registry
  // for the game-specific Guide and Scoreboard overlays below.
  const gameId = seg;
  // Registry-driven overlay bodies (both read their own store): the scoreboard
  // standings for this game, and its guide (falling back to the default guide).
  const Standings = GAME_DESCRIPTORS[gameId]?.play?.Standings;
  const Guide = GAME_DESCRIPTORS[gameId]?.play?.Guide ?? BidBaaziGuide;

  const leave = useLeaveRoom();
  const handleLeave = () => {
    if (!window.confirm('Leave the game? You will return to the home screen.')) return;
    leave();
  };

  return (
    <>
      <header className="app-header">
        <Link to="/" className="app-header__brand" title="CardClub Lounge">
          <img src={logo} alt="CardClub" className="app-header__logo" />
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
      {!!activeGameId && (
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
