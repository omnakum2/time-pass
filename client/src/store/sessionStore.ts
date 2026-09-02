import { create } from 'zustand';
import { BUBBLE_MS } from '../constants';

interface ErrorState { code: string; message: string }

/**
 * Game-agnostic session / connection / chat / error state. Shared by every game
 * (BidBaazi, Thoso, …): the socket connection flag, our seat identity
 * (playerId / roomId), reconnect + room-closed signals, transient error toasts,
 * and the per-player quick-chat bubbles. Per-game board state lives in each
 * game's own store (e.g. bidbaaziStore, thosoStore).
 */
interface SessionStore {
  connected: boolean;
  playerId: string | null;
  roomId: string | null;
  error: ErrorState | null;
  roomClosed: boolean;
  reconnectFailed: boolean; // last session-reconnect attempt failed (room gone / bad token)
  activeBubbles: Record<string, { text: string; key: number }>; // playerId → quick-chat bubble

  setConnected: (v: boolean) => void;
  setRoomClosed: (v: boolean) => void;
  setReconnectFailed: (v: boolean) => void;
  setSession: (playerId: string, roomId: string) => void;
  setError: (code: string, message: string) => void;
  clearError: () => void;
  setBubble: (playerId: string, text: string) => void;
  reset: () => void;
}

let bubbleKey = 0;

export const useSessionStore = create<SessionStore>((set) => ({
  connected: false,
  playerId: null,
  roomId: null,
  error: null,
  roomClosed: false,
  reconnectFailed: false,
  activeBubbles: {},

  setConnected: (connected) => set({ connected }),
  setRoomClosed: (roomClosed) => set({ roomClosed }),
  setReconnectFailed: (reconnectFailed) => set({ reconnectFailed }),
  setSession: (playerId, roomId) => set({ playerId, roomId, reconnectFailed: false }),
  setError: (code, message) => set({ error: { code, message } }),
  clearError: () => set({ error: null }),
  setBubble: (playerId, text) => {
    const key = ++bubbleKey;
    set((s) => ({ activeBubbles: { ...s.activeBubbles, [playerId]: { text, key } } }));
    setTimeout(() => set((s) => {
      if (s.activeBubbles[playerId]?.key !== key) return {}; // replaced by a newer bubble
      const next = { ...s.activeBubbles };
      delete next[playerId];
      return { activeBubbles: next };
    }), BUBBLE_MS);
  },
  reset: () => set({
    playerId: null, roomId: null, error: null, roomClosed: false,
    reconnectFailed: false, activeBubbles: {},
  }),
}));
