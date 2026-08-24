import { useEffect, useState } from 'react';
import { RING_TICK_MS } from '../constants';

interface Countdown {
  elapsed: number;   // ms since (re)start
  fraction: number;  // 0 … 1 of the duration elapsed
  remaining: number; // whole seconds left
}

/**
 * Server-anchored countdown, measured against the full turn budget `fullMs`.
 * Re-anchors whenever `startKey` changes (new turn / resume). When `running` is
 * false (game paused) it holds the seeded value without ticking.
 *
 * When `expiresAt` (an absolute epoch-ms deadline) is supplied, remaining time is
 * computed fresh from it on every tick — immune to drift from the gap between
 * when the server snapshotted `remainingMs` and when this component actually
 * mounted (network + render latency). Falls back to the older `remainingMs -
 * elapsed-since-mount` estimate when no deadline is available.
 */
export function useCountdown(
  remainingMs: number, fullMs: number, startKey: string, running = true, expiresAt?: number | null,
): Countdown {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    setElapsed(0);
    if (!running) return;
    const start = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - start), RING_TICK_MS);
    return () => clearInterval(id);
  }, [startKey, running]);

  const live = expiresAt != null
    ? Math.max(0, expiresAt - Date.now())
    : Math.max(0, remainingMs - elapsed); // ms left, seeded from the server
  const fraction = fullMs > 0 ? Math.min(1, Math.max(0, (fullMs - live) / fullMs)) : 0;
  const remaining = Math.ceil(live / 1000);
  return { elapsed, fraction, remaining };
}
