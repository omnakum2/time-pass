import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { useThosoStore } from '../store/thosoStore';
import { sendMsg } from '../net/socket';
import { storage } from '../storage';
import { STORAGE_KEYS } from '../constants';

/**
 * Shared leave-teardown. Returns a `leave` callback that performs the full,
 * game-agnostic exit: releases our seat server-side, clears the saved session
 * and any pending-invite handoff, resets both game stores, and navigates home.
 *
 * Confirm-free by design so every caller (Header, ThosoRoomPage, WinnerPage)
 * shares one teardown; a caller that wants a prompt (e.g. Header) confirms first.
 */
export function useLeaveRoom(): () => void {
  const navigate = useNavigate();

  return () => {
    sendMsg({ type: 'leaveRoom' }); // release our seat server-side before leaving
    storage.clearSession();
    sessionStorage.removeItem(STORAGE_KEYS.pendingRoomId);
    sessionStorage.removeItem(STORAGE_KEYS.pendingHost);
    useThosoStore.getState().reset();
    useGameStore.getState().reset();
    navigate('/', { replace: true });
  };
}
