import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { TOAST_DISMISS_MS } from '../constants';
import { Icon } from './Icon';

interface ErrorToastProps {
  message?: string | null;
  onClose?: () => void;
}

export function ErrorToast({ message, onClose }: ErrorToastProps = {}) {
  const { error, clearError } = useGameStore();

  const handleClose = onClose ?? clearError;
  const activeMessage = message ?? (error ? (error.message || 'Something went wrong.') : '');
  const visible = Boolean(message || error);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(handleClose, TOAST_DISMISS_MS);
    return () => clearTimeout(t);
  }, [visible, handleClose]);

  return (
    <div
      className={`error-toast${visible ? ' error-toast--visible' : ''}`}
      role="alert"
      aria-live="assertive"
      onClick={handleClose}
    >
      <span className="error-toast__msg">{activeMessage}</span>
      <button
        type="button"
        className="error-toast__close"
        aria-label="Dismiss"
        onClick={(e) => { e.stopPropagation(); handleClose(); }}
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}
