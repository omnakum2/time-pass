import { create } from 'zustand';
import { BidBaaziState, MsgGameOver, MsgRoundResult } from 'shared';

/**
 * BidBaazi-specific game state: the authoritative board (gameState), the last
 * round-result payload, and the game-over payload. Session / connection / chat /
 * error state is game-agnostic and lives in sessionStore.
 */
interface BidBaaziStore {
  gameState: BidBaaziState | null;
  lastRoundResult: MsgRoundResult | null;
  gameOver: MsgGameOver | null;

  setState: (s: BidBaaziState) => void;
  setRoundResult: (r: MsgRoundResult) => void;
  setGameOver: (g: MsgGameOver) => void;
  reset: () => void;
}

export const useBidBaaziStore = create<BidBaaziStore>((set) => ({
  gameState: null,
  lastRoundResult: null,
  gameOver: null,

  setState: (gameState) => set((s) => ({ gameState, gameOver: gameState.phase === 'GAME_OVER' ? s.gameOver : null })),
  setRoundResult: (lastRoundResult) => set({ lastRoundResult }),
  setGameOver: (gameOver) => set({ gameOver }),
  reset: () => set({ gameState: null, lastRoundResult: null, gameOver: null }),
}));
