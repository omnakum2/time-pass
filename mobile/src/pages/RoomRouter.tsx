import { useGameStore } from '../store/gameStore';
import { LobbyPage } from './LobbyPage';
import { GamePage } from './GamePage';
import { WinnerPage } from './WinnerPage';

// Switches the in-room view by game phase (mirrors the web RoomRouter):
//   • game over → Winner
//   • LOBBY (or no phase yet) → Lobby
//   • any play phase → Game
export function RoomRouter() {
  const gameState = useGameStore((s) => s.gameState);
  const gameOver = useGameStore((s) => s.gameOver);
  const phase = gameState?.phase;

  if (gameOver) return <WinnerPage />;
  if (!phase || phase === 'LOBBY') return <LobbyPage />;
  return <GamePage />;
}
