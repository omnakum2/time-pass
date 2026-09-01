import { create } from 'zustand';
import { ThosoState } from 'shared';

interface ThosoStore {
  state: ThosoState | null;
  setThosoState: (s: ThosoState) => void;
  reset: () => void;
}
export const useThosoStore = create<ThosoStore>((set) => ({
  state: null,
  setThosoState: (state) => set({ state }),
  reset: () => set({ state: null }),
}));
