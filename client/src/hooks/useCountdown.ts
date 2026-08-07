import { useEffect, useState } from 'react';

interface Countdown {
  elapsed: number;   // ms since (re)start
  fraction: number;  // 0 … 1 of the duration elapsed
  remaining: number; // whole seconds left
}

/**
 * Ticks elapsed time every 100ms; resets whenever `startKey` changes.
 * Shared by the bid countdown ring and the active-player turn border.
 */
export function useCountdown(durationMs: number, startKey: string): Countdown {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    setElapsed(0);
    const start = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - start), 100);
    return () => clearInterval(id);
  }, [startKey]);

  const fraction = Math.min(elapsed / durationMs, 1);
  const remaining = Math.max(0, Math.ceil((durationMs - elapsed) / 1000));
  return { elapsed, fraction, remaining };
}
