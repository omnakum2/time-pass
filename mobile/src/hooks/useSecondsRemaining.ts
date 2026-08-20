import { useEffect, useState } from 'react';
import { COUNTDOWN_TICK_MS } from '../constants';

/**
 * Shared per-second countdown. Seeds from `ms` (ceil to whole seconds) and ticks
 * down by one every `COUNTDOWN_TICK_MS`, stopping at 0. Re-seeds whenever `ms`
 * changes and clears its interval on unmount. Returns `null` while `ms` is `null`
 * (i.e. no countdown is active).
 */
export function useSecondsRemaining(ms: number | null): number | null {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(
    ms == null ? null : Math.ceil(ms / 1000),
  );

  useEffect(() => {
    if (ms == null) {
      setSecondsLeft(null);
      return;
    }
    setSecondsLeft(Math.ceil(ms / 1000));
    const id = setInterval(() => {
      setSecondsLeft(prev => (prev == null ? null : Math.max(0, prev - 1)));
    }, COUNTDOWN_TICK_MS);
    return () => clearInterval(id);
  }, [ms]);

  return secondsLeft;
}
