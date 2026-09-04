import { create } from 'zustand';
import { ThosoState } from 'shared';

interface ThosoStore {
  state: ThosoState | null;
  setState: (s: ThosoState) => void;
  reset: () => void;
}
export const useThosoStore = create<ThosoStore>((set) => ({
  state: null,
  setState: (state) => set({ state }),
  reset: () => set({ state: null }),
}));
