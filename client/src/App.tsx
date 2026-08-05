import { Routes, Route, Navigate } from 'react-router-dom';
import { useGameStore } from './store/gameStore';
import { HomePage } from './pages/HomePage';
import { LobbyPage } from './pages/LobbyPage';
import { GamePage } from './pages/GamePage';
import { WinnerPage } from './pages/WinnerPage';
import { GuidePage } from './pages/GuidePage';
import { Header } from './components/Header';
import { ErrorToast } from './components/ErrorToast';
import { ConnectionBanner } from './components/ConnectionBanner';

export default function App() {
  const { gameState, gameOver } = useGameStore();
  const phase = gameState?.phase;
  return (
    <div className="app-shell">
      <ConnectionBanner />
      <ErrorToast />
      <Header />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/guide" element={<GuidePage />} />
          <Route path="/room/:roomId" element={<RoomRouter phase={phase} hasGameOver={!!gameOver} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function RoomRouter({ phase, hasGameOver }: { phase: string | undefined; hasGameOver: boolean }) {
  if (hasGameOver) return <WinnerPage />;
  if (!phase || phase === 'LOBBY') return <LobbyPage />;
  return <GamePage />;
}
