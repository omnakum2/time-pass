import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { TOAST_DISMISS_MS } from '../constants';
import { Icon } from './Icon';

export function ErrorToast() {
  const { error, clearError } = useGameStore();

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(clearError, TOAST_DISMISS_MS);
    return () => clearTimeout(t);
  }, [error, clearError]);

  const msg = error ? (error.message || 'Something went wrong.') : '';

  return (
    <div
      className={`error-toast${error ? ' error-toast--visible' : ''}`}
      role="alert"
      aria-live="assertive"
      onClick={clearError}
    >
      <span className="error-toast__msg">{msg}</span>
      <button
        type="button"
        className="error-toast__close"
        aria-label="Dismiss"
        onClick={(e) => { e.stopPropagation(); clearError(); }}
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}
