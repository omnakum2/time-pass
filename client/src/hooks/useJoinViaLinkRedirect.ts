import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { storage } from '../storage';
import { STORAGE_KEYS } from '../constants';

/**
 * Handles a fresh/stale visitor landing directly on a `/:game/room/:roomId` link.
 *
 * If we're not in a room and the socket is connected: when we already hold a
 * session for THIS room an auto-reconnect is in flight, so we wait for it (unless
 * that reconnect just failed). Otherwise it's a genuine newcomer (or a leftover
 * session from a dead/other room) — we stash the room id (and `?host=`) and bounce
 * to the game home so they can enter a name and join.
 */
export function useJoinViaLinkRedirect(game: string, urlRoomId: string | undefined): void {
  const navigate = useNavigate();
  const { roomId, connected, reconnectFailed } = useGameStore();

  useEffect(() => {
    if (roomId || !urlRoomId || !connected) return;
    // If we already hold a session for THIS room, an auto-reconnect is in flight — wait
    // for it instead of bouncing to the join prompt (unless that reconnect just failed).
    const session = storage.getSession();
    const mineForThisRoom = session?.roomId?.toUpperCase() === urlRoomId.toUpperCase();
    if (mineForThisRoom && !reconnectFailed) return;
    // Genuine newcomer (or the reconnect failed): go home with the code (and host) pre-filled.
    const host = new URLSearchParams(window.location.search).get('host');
    sessionStorage.setItem(STORAGE_KEYS.pendingRoomId, urlRoomId);
    if (host) sessionStorage.setItem(STORAGE_KEYS.pendingHost, host);
    navigate(`/${game}`, { replace: true });
  }, [roomId, urlRoomId, connected, reconnectFailed, game, navigate]);
}
