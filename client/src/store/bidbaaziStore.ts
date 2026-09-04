import { create } from 'zustand';
import { BidBaaziState, MsgGameOver, MsgRoundResult } from 'shared';

/**
 * BidBaazi-specific game state: the authoritative board (gameState), the last
 * round-result payload, and the game-over payload. Session / connection / chat /
 * error state is game-agnostic and lives in sessionStore.
 */
interface BidBaaziStore {
  state: BidBaaziState | null;
  lastRoundResult: MsgRoundResult | null;
  gameOver: MsgGameOver | null;

  setState: (s: BidBaaziState) => void;
  setRoundResult: (r: MsgRoundResult) => void;
  setGameOver: (g: MsgGameOver) => void;
  reset: () => void;
}

export const useBidBaaziStore = create<BidBaaziStore>((set) => ({
  state: null,
  lastRoundResult: null,
  gameOver: null,

  setState: (state) => set((s) => ({ state, gameOver: state.phase === 'GAME_OVER' ? s.gameOver : null })),
  setRoundResult: (lastRoundResult) => set({ lastRoundResult }),
  setGameOver: (gameOver) => set({ gameOver }),
  reset: () => set({ state: null, lastRoundResult: null, gameOver: null }),
}));
