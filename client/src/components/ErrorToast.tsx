import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

const FRIENDLY: Record<string, string> = {
  ROOM_NOT_FOUND: 'That room has expired or no longer exists.',
  GAME_STARTED: 'That game has already started.',
  ROOM_FULL: 'Room is full (max 7 players).',
  NOT_HOST: 'Only the host can do that.',
  NOT_YOUR_TURN: 'It\'s not your turn.',
  INVALID_BID: 'Invalid bid.',
  ILLEGAL_CARD: 'You must follow the lead suit if you can.',
  NOT_ENOUGH_PLAYERS: 'Need at least 2 players to start.',
  INVALID_TOKEN: 'Your session expired. Please rejoin.',
};

export function ErrorToast() {
  const { error, clearError } = useGameStore();

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(clearError, 4000);
    return () => clearTimeout(t);
  }, [error, clearError]);

  const msg = error ? (FRIENDLY[error.code] ?? error.message) : '';

  return (
    <div className={`error-toast${error ? ' error-toast--visible' : ''}`} onClick={clearError}>
      {msg}
    </div>
  );
}
