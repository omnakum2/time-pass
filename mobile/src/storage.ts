import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS, SESSION_TTL_MS } from './constants';

const SESSION_VERSION = 1;

export interface StoredPlayer { name: string }
export interface StoredSession { roomId: string; token: string; playerId: string; savedAt: number; v: number }

// AsyncStorage is async, but the WebSocket reconnect path (onopen) needs to read
// the current seat synchronously to decide whether to send a reconnect message.
// We keep a synchronous in-memory mirror of the last-known-good session here;
// hydrate() populates it once at app boot, and getCachedSession() reads it with no await.
let sessionCache: StoredSession | null = null;

export const storage = {
  async getPlayer(): Promise<StoredPlayer | null> {
    try { return JSON.parse((await AsyncStorage.getItem(STORAGE_KEYS.player)) ?? 'null'); } catch { return null; }
  },
  async setPlayer(p: StoredPlayer): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.player, JSON.stringify(p));
  },
  async getSession(): Promise<StoredSession | null> {
    try {
      const s = JSON.parse((await AsyncStorage.getItem(STORAGE_KEYS.session)) ?? 'null') as StoredSession | null;
      if (!s) return null;
      // Reject stale/incompatible sessions: wrong schema version, malformed timestamp, or past TTL.
      if (s.v !== SESSION_VERSION || typeof s.savedAt !== 'number' || Date.now() - s.savedAt > SESSION_TTL_MS) {
        await AsyncStorage.removeItem(STORAGE_KEYS.session);
        sessionCache = null;
        return null;
      }
      sessionCache = s;
      return s;
    } catch { return null; }
  },
  async setSession(s: { roomId: string; token: string; playerId: string }): Promise<void> {
    const full: StoredSession = { ...s, savedAt: Date.now(), v: SESSION_VERSION };
    await AsyncStorage.setItem(STORAGE_KEYS.session, JSON.stringify(full));
    sessionCache = full;
  },
  async clearSession(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.session);
    sessionCache = null;
  },
  // Call once at app boot to populate sessionCache before the first render, so the
  // socket reconnect path has a synchronous read available. getSession() sets the
  // cache as a side effect, so we ignore the returned value here.
  async hydrate(): Promise<void> {
    await this.getSession();
  },
  // Synchronous read of the last-known session for the WebSocket onopen handler,
  // which cannot await AsyncStorage before deciding whether to reconnect.
  getCachedSession(): StoredSession | null {
    return sessionCache;
  },
};
