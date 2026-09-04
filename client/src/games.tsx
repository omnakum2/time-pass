import { ComponentType, lazy } from 'react';
import { useBidBaaziStore } from './store/bidbaaziStore';
import { useThosoStore } from './store/thosoStore';
import { LobbyPage } from './pages/LobbyPage';
import { GamePage } from './pages/GamePage';
import { ThosoRoomPage } from './pages/ThosoRoomPage';
import { BidBaaziScoreboard } from './components/BidBaaziScoreboard';
import { ThosoStandings } from './components/ThosoStandings';
import { ThosoGuide } from './components/ThosoGuide';
import { BidBaaziGuide } from './components/BidBaaziGuide';

// WinnerPage stays code-split — as it was when App owned this routing — since the
// winner screen isn't needed until a game actually ends. Rendered by BidBaaziRoomRoot
// inside App's route-level <Suspense>.
const WinnerPage = lazy(() =>
  import('./pages/WinnerPage').then((m) => ({ default: m.WinnerPage }))
);

/**
 * CLIENT game registry — one GAME_DESCRIPTORS entry per game, keyed by game id
 * (the client mirror of the server's ROOM_FACTORIES).
 *
 * Every per-game choice that used to be a scattered `game === 'thoso'` switch —
 * in-room root, header overlays, guide, state-message routing, in-game phase sets,
 * and lounge-card art — collapses into a single descriptor here. Adding a game is
 * one-place-safe: add a GAME_DESCRIPTORS entry (plus the shared registry entry and
 * the server ROOM_FACTORIES) and nothing else in the client changes.
 *
 * A PLAYABLE game carries a `play` block; its components are PROP-LESS (each reads
 * its own store), so App / Header / GuidePage render `<RoomRoot/>`, `<Standings/>`,
 * `<Guide/>` without knowing the game. A coming-soon game carries only lounge art.
 */

/**
 * BidBaazi in-room root — encapsulates the old App `RoomRouter` phase logic so it
 * needs no props: reads phase + gameOver from the game store and picks the screen.
 */
function BidBaaziRoomRoot() {
  const gameState = useBidBaaziStore((s) => s.state);
  const gameOver = useBidBaaziStore((s) => s.gameOver);
  const phase = gameState?.phase;
  if (gameOver) return <WinnerPage />;
  if (!phase || phase === 'LOBBY') return <LobbyPage />;
  return <GamePage />;
}

/** BidBaazi scoreboard body — reads the game store; renders nothing before a game exists. */
function BidBaaziStandings() {
  const gameState = useBidBaaziStore((s) => s.state);
  return gameState ? <BidBaaziScoreboard gameState={gameState} /> : null;
}

/** Thoso rank board — reads the Thoso store; renders nothing before a game exists. */
function ThosoStandingsPanel() {
  const state = useThosoStore((s) => s.state);
  return state ? <ThosoStandings state={state} /> : null;
}

/* ── Lounge-card art (moved from GameSelectionPage) ─────────────────────────── */
interface MiniCardData {
  rank: string;
  suit: string;
  color: 'red' | 'black';
}

export interface GameCardConfig {
  cards: MiniCardData[];
  fanClass: string;
}

// Gameplay wiring for a PLAYABLE game. Undefined for coming-soon games (lounge art only).
interface GamePlay {
  RoomRoot: ComponentType;                              // in-room UI root (lobby/game/winner)
  Standings: ComponentType;                             // header scoreboard-overlay body
  Guide: ComponentType<{ showHomeLink?: boolean }>;     // guide content
  applyState: (s: any) => void;                         // push a state payload into this game's store (routed by state.game)
  isInGame: (phase?: string) => boolean;                // is this phase an "in a live game" phase?
}

// One descriptor per game (client mirror of the server ROOM_FACTORIES). Coming-soon
// games carry only lounge art; `play` is present only for playable games.
export interface GameDescriptor {
  loungeCard: GameCardConfig;
  play?: GamePlay;
}

// In-game phase sets (moved here from store/activeGame.ts) — consulted by each game's isInGame.
const BIDBAAZI_INGAME_PHASES = new Set([
  'DEALING', 'TRUMP_SELECT', 'BIDDING', 'PUSH', 'PLAYING', 'ROUND_SCORING',
]);
const THOSO_INGAME_PHASES = new Set(['TRANSFER', 'PLAYING', 'GAME_OVER']);

export const GAME_DESCRIPTORS: Record<string, GameDescriptor> = {
  bidbaazi: {
    loungeCard: {
      fanClass: 'fan-5',
      cards: [
        { rank: 'A', suit: '♥', color: 'red' },
        { rank: 'K', suit: '♥', color: 'red' },
        { rank: 'Q', suit: '♥', color: 'red' },
        { rank: 'J', suit: '♥', color: 'red' },
        { rank: '10', suit: '♥', color: 'red' },
      ],
    },
    play: {
      RoomRoot: BidBaaziRoomRoot,
      Standings: BidBaaziStandings,
      Guide: BidBaaziGuide,
      applyState: (s) => useBidBaaziStore.getState().setState(s),
      isInGame: (phase) => !!phase && BIDBAAZI_INGAME_PHASES.has(phase),
    },
  },
  rummy: {
    loungeCard: {
      fanClass: 'fan-5',
      cards: [
        { rank: 'A', suit: '♠', color: 'black' },
        { rank: 'K', suit: '♠', color: 'black' },
        { rank: 'Q', suit: '♦', color: 'red' },
        { rank: '', suit: '', color: 'black' }, // Card back (reusing Blind card back)
        { rank: 'A', suit: '♦', color: 'red' },
      ],
    },
  },
  thoso: {
    loungeCard: {
      fanClass: 'fan-4',
      cards: [
        { rank: 'A', suit: '♣', color: 'black' },
        { rank: 'K', suit: '♣', color: 'black' },
        { rank: '7', suit: '♠', color: 'black' },
        { rank: '10', suit: '♠', color: 'black' },
      ],
    },
    play: {
      RoomRoot: ThosoRoomPage,
      Standings: ThosoStandingsPanel,
      Guide: ThosoGuide,
      applyState: (s) => useThosoStore.getState().setState(s),
      isInGame: (phase) => !!phase && THOSO_INGAME_PHASES.has(phase),
    },
  },
};
