const KEYS = {
  player: 'pcg.player',
  session: 'pcg.session',
} as const;

export interface StoredPlayer { name: string }
export interface StoredSession { roomId: string; token: string; playerId: string }

export const storage = {
  getPlayer(): StoredPlayer | null {
    try { return JSON.parse(localStorage.getItem(KEYS.player) ?? 'null'); } catch { return null; }
  },
  setPlayer(p: StoredPlayer): void {
    localStorage.setItem(KEYS.player, JSON.stringify(p));
  },
  getSession(): StoredSession | null {
    try { return JSON.parse(localStorage.getItem(KEYS.session) ?? 'null'); } catch { return null; }
  },
  setSession(s: StoredSession): void {
    localStorage.setItem(KEYS.session, JSON.stringify(s));
  },
  clearSession(): void {
    localStorage.removeItem(KEYS.session);
  },
};
