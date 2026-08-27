import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { GAMES } from 'shared';
import { useGameStore } from './store/gameStore';
import { Header } from './components/Header';
import { GameSelectionPage } from './pages/GameSelectionPage';
import { HomePage } from './pages/HomePage';
import { LobbyPage } from './pages/LobbyPage';
import { GamePage } from './pages/GamePage';
const GuidePage = lazy(() => import('./pages/GuidePage').then(m => ({ default: m.GuidePage })));
const WinnerPage = lazy(() => import('./pages/WinnerPage').then(m => ({ default: m.WinnerPage })));
import { ErrorToast } from './components/ErrorToast';

export default function App() {
  const { gameState, gameOver } = useGameStore();
  const phase = gameState?.phase;
  return (
    <div className="app-shell">
      <ThemeSync />
      <Header />
      <ErrorToast />
      <main className="app-main">
        <Suspense fallback={<div className="page"><p>Loading…</p></div>}>
          <Routes>
            <Route path="/" element={<GameSelectionPage />} />
            <Route path="/:game" element={<GameGate><HomePage /></GameGate>} />
            <Route path="/:game/guide" element={<GameGate><GuidePage /></GameGate>} />
            <Route path="/:game/room/:roomId" element={<GameGate><RoomRouter phase={phase} hasGameOver={!!gameOver} /></GameGate>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}

function RoomRouter({ phase, hasGameOver }: { phase: string | undefined; hasGameOver: boolean }) {
  if (hasGameOver) return <WinnerPage />;
  if (!phase || phase === 'LOBBY') return <LobbyPage />;
  return <GamePage />;
}

function GameGate({ children }: { children: JSX.Element }) {
  const { game } = useParams();
  const ok = GAMES.some(g => g.id === game && g.status === 'active');
  return ok ? children : <Navigate to="/" replace />;
}

function ThemeSync() {
  const { pathname } = useLocation();
  useEffect(() => {
    const seg = pathname.split('/')[1];
    const game =
      seg === 'bid-club' ? 'bid-club' :
      seg === 'rummy' ? 'rummy' :
      seg === 'thoso' ? 'thoso' :
      null;
    const root = document.documentElement;
    if (game) root.setAttribute('data-game', game);
    else root.removeAttribute('data-game'); // lounge / neutral
  }, [pathname]);
  return null;
}
