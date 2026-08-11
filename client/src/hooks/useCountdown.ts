import { useEffect, useState } from 'react';

interface Countdown {
  elapsed: number;   // ms since (re)start
  fraction: number;  // 0 … 1 of the duration elapsed
  remaining: number; // whole seconds left
}

/**
 * Server-anchored countdown. Seeds from the server's `remainingMs` (time left on the
 * turn's FIXED deadline) and ticks locally; the ring fraction is measured against the
 * full turn budget `fullMs`. Re-anchors whenever `startKey` changes (new turn / resume).
 * Because it seeds from the server each time, a refresh can never reset or extend the
 * clock, and every client shows the same remaining time. When `running` is false (game
 * paused) it holds the seeded value without ticking.
 */
export function useCountdown(remainingMs: number, fullMs: number, startKey: string, running = true): Countdown {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    setElapsed(0);
    if (!running) return;
    const start = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - start), 100);
    return () => clearInterval(id);
  }, [startKey, running]);

  const live = Math.max(0, remainingMs - elapsed); // ms left, seeded from the server
  const fraction = fullMs > 0 ? Math.min(1, Math.max(0, (fullMs - live) / fullMs)) : 0;
  const remaining = Math.ceil(live / 1000);
  return { elapsed, fraction, remaining };
}
