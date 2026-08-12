import { STORAGE_KEYS, SESSION_TTL_MS } from './constants';

const SESSION_VERSION = 1;

export interface StoredPlayer { name: string }
export interface StoredSession { roomId: string; token: string; playerId: string; savedAt: number; v: number }

export const storage = {
  getPlayer(): StoredPlayer | null {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.player) ?? 'null'); } catch { return null; }
  },
  setPlayer(p: StoredPlayer): void {
    localStorage.setItem(STORAGE_KEYS.player, JSON.stringify(p));
  },
  getSession(): StoredSession | null {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEYS.session) ?? 'null') as StoredSession | null;
      if (!s) return null;
      if (s.v !== SESSION_VERSION || typeof s.savedAt !== 'number' || Date.now() - s.savedAt > SESSION_TTL_MS) {
        localStorage.removeItem(STORAGE_KEYS.session);
        return null;
      }
      return s;
    } catch { return null; }
  },
  setSession(s: { roomId: string; token: string; playerId: string }): void {
    const full: StoredSession = { ...s, savedAt: Date.now(), v: SESSION_VERSION };
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(full));
  },
  clearSession(): void {
    localStorage.removeItem(STORAGE_KEYS.session);
  },
};
