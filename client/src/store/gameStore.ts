import { create } from 'zustand';
import { GameState, MsgGameOver, MsgRoundResult } from 'shared';

interface ErrorState { code: string; message: string }

interface GameStore {
  connected: boolean;
  playerId: string | null;
  roomId: string | null;
  gameState: GameState | null;
  lastRoundResult: MsgRoundResult | null;
  gameOver: MsgGameOver | null;
  error: ErrorState | null;

  setConnected: (v: boolean) => void;
  setSession: (playerId: string, roomId: string) => void;
  setState: (s: GameState) => void;
  setRoundResult: (r: MsgRoundResult) => void;
  setGameOver: (g: MsgGameOver) => void;
  setError: (code: string, message: string) => void;
  clearError: () => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  connected: false,
  playerId: null,
  roomId: null,
  gameState: null,
  lastRoundResult: null,
  gameOver: null,
  error: null,

  setConnected: (connected) => set({ connected }),
  setSession: (playerId, roomId) => set({ playerId, roomId }),
  setState: (gameState) => set({ gameState, gameOver: null }),
  setRoundResult: (lastRoundResult) => set({ lastRoundResult }),
  setGameOver: (gameOver) => set({ gameOver }),
  setError: (code, message) => set({ error: { code, message } }),
  clearError: () => set({ error: null }),
  reset: () => set({
    playerId: null, roomId: null, gameState: null,
    lastRoundResult: null, gameOver: null, error: null,
  }),
}));
