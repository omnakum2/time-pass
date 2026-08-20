import { useEffect, useRef, useState } from 'react';
import { RING_TICK_MS } from '../constants';

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
  // Seed the remaining time ONCE at anchor (startKey change). Later same-anchor
  // rebroadcasts (e.g. every player's decision in the all-at-once PUSH phase, or a
  // quick-chat during a turn) must NOT re-subtract elapsed — that caused the ring to
  // jump down. The absolute deadline is fixed, so we tick locally from this seed.
  const seededRemainingMs = useRef(remainingMs);

  useEffect(() => {
    seededRemainingMs.current = remainingMs;
    setElapsed(0);
    if (!running) return;
    const start = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - start), RING_TICK_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remainingMs is re-seeded only on anchor, never tracked live
  }, [startKey, running]);

  const live = Math.max(0, seededRemainingMs.current - elapsed); // seeded at anchor; immune to same-anchor rebroadcasts
  const fraction = fullMs > 0 ? Math.min(1, Math.max(0, (fullMs - live) / fullMs)) : 0;
  const remaining = Math.ceil(live / 1000);
  return { elapsed, fraction, remaining };
}
