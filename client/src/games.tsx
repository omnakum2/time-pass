import { ComponentType, lazy } from 'react';
import { useBidBaaziStore } from './store/bidbaaziStore';
import { useThosoStore } from './store/thosoStore';
import { LobbyPage } from './pages/LobbyPage';
import { GamePage } from './pages/GamePage';
import { ThosoRoomPage } from './pages/ThosoRoomPage';
import { BidBaaziScoreboard } from './components/BidBaaziScoreboard';
import { ThosoStandings } from './components/ThosoStandings';
import { ThosoGuide } from './components/ThosoGuide';
import { GuideContent } from './pages/GuidePage';

// WinnerPage stays code-split — as it was when App owned this routing — since the
// winner screen isn't needed until a game actually ends. Rendered by BidBaaziRoomRoot
// inside App's route-level <Suspense>.
const WinnerPage = lazy(() =>
  import('./pages/WinnerPage').then((m) => ({ default: m.WinnerPage }))
);

/**
 * CLIENT game-component registry.
 *
 * Every per-game COMPONENT choice that used to be a scattered `game === 'thoso'`
 * switch (in App / Header / GuidePage) lives here, keyed by game id. Adding a game
 * is one-place-safe: add a GAME_COMPONENTS entry here (plus the shared registry
 * entry and the server ROOM_FACTORIES) and nothing else in the client changes.
 *
 * Each component is PROP-LESS: it reads its own store internally, so App / Header /
 * GuidePage render `<Root/>`, `<Standings/>`, `<Guide/>` without knowing the game.
 */
interface GameComponents {
  /** In-room UI root (lobby / game / winner) — reads its own store. */
  RoomRoot: ComponentType;
  /** Header scoreboard-overlay body — reads its own store, renders nothing when idle. */
  Standings: ComponentType;
  /** Guide content (self-contained). `showHomeLink` is honoured on the standalone page. */
  Guide: ComponentType<{ showHomeLink?: boolean }>;
}

/**
 * BidBaazi in-room root — encapsulates the old App `RoomRouter` phase logic so it
 * needs no props: reads phase + gameOver from the game store and picks the screen.
 */
function BidBaaziRoomRoot() {
  const gameState = useBidBaaziStore((s) => s.gameState);
  const gameOver = useBidBaaziStore((s) => s.gameOver);
  const phase = gameState?.phase;
  if (gameOver) return <WinnerPage />;
  if (!phase || phase === 'LOBBY') return <LobbyPage />;
  return <GamePage />;
}

/** BidBaazi scoreboard body — reads the game store; renders nothing before a game exists. */
function BidBaaziStandings() {
  const gameState = useBidBaaziStore((s) => s.gameState);
  return gameState ? <BidBaaziScoreboard gameState={gameState} /> : null;
}

/** Thoso rank board — reads the Thoso store; renders nothing before a game exists. */
function ThosoStandingsPanel() {
  const state = useThosoStore((s) => s.state);
  return state ? <ThosoStandings state={state} /> : null;
}

export const GAME_COMPONENTS: Record<string, GameComponents> = {
  'bidbaazi': { RoomRoot: BidBaaziRoomRoot, Standings: BidBaaziStandings, Guide: GuideContent },
  'thoso': { RoomRoot: ThosoRoomPage, Standings: ThosoStandingsPanel, Guide: ThosoGuide },
};
