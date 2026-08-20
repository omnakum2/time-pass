import { create } from 'zustand';
import { GameState, MsgGameOver, MsgRoundResult, UserAccount } from 'shared';
import { BUBBLE_MS } from '../constants';

interface ErrorState { code: string; message: string }

// V3 daily-login + spin status (mirrors MsgRewardsStatus minus the `type` tag).
export interface RewardsStatus {
  canClaimDaily: boolean;
  streak: number;
  spinsUsedToday: number;
  nextSpinCost: number | null;
}

// Transient "you got X" banner shown after a claim / spin (client-only).
export interface RewardToast { kind: 'daily' | 'spin'; coins: number; gems: number }

// Last spin result (client-only): the winning segment index + its prize. Drives
// the Lucky Spin wheel's landing animation; survives reset() by design.
export interface LastSpin { segmentIndex: number; coins: number; gems: number }

interface GameStore {
  connected: boolean;
  playerId: string | null;
  roomId: string | null;
  gameState: GameState | null;
  lastRoundResult: MsgRoundResult | null;
  gameOver: MsgGameOver | null;
  error: ErrorState | null;
  roomClosed: boolean;
  reconnectFailed: boolean; // last session-reconnect attempt failed (room gone / bad token)
  activeBubbles: Record<string, { text: string; key: number }>; // playerId → quick-chat bubble
  account: UserAccount | null; // V3: authenticated identity + wallet (null when anonymous)
  rewards: RewardsStatus | null; // V3: daily-login + spin status (null until fetched)
  rewardToast: RewardToast | null; // V3: last claim/spin prize banner (null when none)
  lastSpin: LastSpin | null; // V3: last spin's segment + prize (drives the wheel; null when none)

  setConnected: (v: boolean) => void;
  setRoomClosed: (v: boolean) => void;
  setReconnectFailed: (v: boolean) => void;
  setSession: (playerId: string, roomId: string) => void;
  setState: (s: GameState) => void;
  setRoundResult: (r: MsgRoundResult) => void;
  setGameOver: (g: MsgGameOver) => void;
  setAccount: (a: UserAccount) => void;
  setRewards: (r: RewardsStatus) => void;
  setRewardToast: (t: RewardToast | null) => void;
  setLastSpin: (v: LastSpin | null) => void;
  setError: (code: string, message: string) => void;
  clearError: () => void;
  setBubble: (playerId: string, text: string) => void;
  reset: () => void;
}

let bubbleKey = 0;

export const useGameStore = create<GameStore>((set) => ({
  connected: false,
  playerId: null,
  roomId: null,
  gameState: null,
  lastRoundResult: null,
  gameOver: null,
  error: null,
  roomClosed: false,
  reconnectFailed: false,
  activeBubbles: {},
  account: null,
  rewards: null,
  rewardToast: null,
  lastSpin: null,

  setConnected: (connected) => set({ connected }),
  setRoomClosed: (roomClosed) => set({ roomClosed }),
  setReconnectFailed: (reconnectFailed) => set({ reconnectFailed }),
  setSession: (playerId, roomId) => set({ playerId, roomId, reconnectFailed: false }),
  setState: (gameState) => set((s) => ({ gameState, gameOver: gameState.phase === 'GAME_OVER' ? s.gameOver : null })),
  setRoundResult: (lastRoundResult) => set({ lastRoundResult }),
  setGameOver: (gameOver) => set({ gameOver }),
  setAccount: (account) => set({ account }),
  setRewards: (rewards) => set({ rewards }),
  setRewardToast: (rewardToast) => set({ rewardToast }),
  setLastSpin: (lastSpin) => set({ lastSpin }),
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
    playerId: null, roomId: null, gameState: null,
    lastRoundResult: null, gameOver: null, error: null, roomClosed: false,
    reconnectFailed: false, activeBubbles: {},
  }),
}));
