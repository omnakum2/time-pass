import { create } from 'zustand';
import { RummyGameState, MsgRummyGameOver } from 'shared';

// Rummy's game payload only — connection/session (connected, playerId, roomId,
// roomClosed, reconnectFailed, errors) is shared game-agnostic state and stays in
// `useGameStore`, since a single WS connection only ever holds one active room
// (bid-club or rummy) at a time.
interface RummyStore {
  gameState: RummyGameState | null;
  gameOver: MsgRummyGameOver | null;
  setState: (s: RummyGameState) => void;
  setGameOver: (g: MsgRummyGameOver) => void;
  reset: () => void;
}

export const useRummyStore = create<RummyStore>((set) => ({
  gameState: null,
  gameOver: null,
  setState: (gameState) => set((s) => ({ gameState, gameOver: gameState.phase === 'GAME_OVER' ? s.gameOver : null })),
  setGameOver: (gameOver) => set({ gameOver }),
  reset: () => set({ gameState: null, gameOver: null }),
}));
