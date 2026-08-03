import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useGameStore } from './store/gameStore';
import { HomePage } from './pages/HomePage';
import { LobbyPage } from './pages/LobbyPage';
import { GamePage } from './pages/GamePage';
import { WinnerPage } from './pages/WinnerPage';
import { ErrorToast } from './components/ErrorToast';
import { ConnectionBanner } from './components/ConnectionBanner';

export default function App() {
  const { gameState, gameOver } = useGameStore();

  // Route based on game phase
  const phase = gameState?.phase;

  return (
    <>
      <ConnectionBanner />
      <ErrorToast />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/room/:roomId" element={<RoomRouter phase={phase} hasGameOver={!!gameOver} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

function RoomRouter({ phase, hasGameOver }: { phase: string | undefined; hasGameOver: boolean }) {
  if (hasGameOver) return <WinnerPage />;
  if (!phase || phase === 'LOBBY') return <LobbyPage />;
  return <GamePage />;
}
