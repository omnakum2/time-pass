import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useGameStore } from './store/gameStore';
import { HomePage } from './pages/HomePage';
import { LobbyPage } from './pages/LobbyPage';
import { GamePage } from './pages/GamePage';
const GuidePage = lazy(() => import('./pages/GuidePage').then(m => ({ default: m.GuidePage })));
const WinnerPage = lazy(() => import('./pages/WinnerPage').then(m => ({ default: m.WinnerPage })));
import { Header } from './components/Header';
import { ErrorToast } from './components/ErrorToast';

export default function App() {
  const { gameState, gameOver } = useGameStore();
  const phase = gameState?.phase;
  return (
    <div className="app-shell">
      <ErrorToast />
      <Header />
      <main className="app-main">
        <Suspense fallback={<div className="page"><p>Loading…</p></div>}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/guide" element={<GuidePage />} />
            <Route path="/room/:roomId" element={<RoomRouter phase={phase} hasGameOver={!!gameOver} />} />
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
