import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

export function ErrorToast() {
  const { error, clearError } = useGameStore();

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(clearError, 4000);
    return () => clearTimeout(t);
  }, [error, clearError]);

  const msg = error?.message || 'Something went wrong.';

  return (
    <div className={`error-toast${error ? ' error-toast--visible' : ''}`} onClick={clearError}>
      {msg}
    </div>
  );
}
