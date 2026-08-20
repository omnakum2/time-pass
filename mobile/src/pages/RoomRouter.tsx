import { useGameStore } from '../store/gameStore';
import { LobbyPage } from './LobbyPage';
import { RoomStub } from './RoomStub';

// Switches the in-room view by game phase (mirrors the web RoomRouter):
//   • game over → Winner (stub until Phase 6)
//   • LOBBY (or no phase yet) → Lobby
//   • any play phase → Game (stub until Phase 4)
export function RoomRouter() {
  const gameState = useGameStore((s) => s.gameState);
  const gameOver = useGameStore((s) => s.gameOver);
  const phase = gameState?.phase;

  if (gameOver) return <RoomStub />;
  if (!phase || phase === 'LOBBY') return <LobbyPage />;
  return <RoomStub />;
}
