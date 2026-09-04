import { create } from 'zustand';
import { BusinessState } from 'shared';

interface BusinessStore {
  state: BusinessState | null;
  setState: (s: BusinessState) => void;
  reset: () => void;
}
export const useBusinessStore = create<BusinessStore>((set) => ({
  state: null,
  setState: (state) => set({ state }),
  reset: () => set({ state: null }),
}));
