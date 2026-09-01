import { useEffect, useState } from 'react';
import { URGENT_LEAD_MS } from '../constants';

/**
 * Near-timeout escalation. Returns `urgent`, which flips to `true` once the live
 * turn countdown drops below `URGENT_LEAD_MS` so the status line can flash.
 *
 * Reset (and only re-armed) on a live turn: `running` marks a running server
 * deadline and `active` marks a turn we should escalate for. `timerKey` re-anchors
 * the timeout when the server's deadline changes (new turn / pause-resume), never
 * on a plain reconnect. During a round-hold (`running` false) it stays `false`.
 */
export function useUrgentTurn(
  timerKey: string,
  running: boolean,
  remainingMs: number,
  active: boolean,
): boolean {
  const [urgent, setUrgent] = useState(false);

  useEffect(() => {
    setUrgent(false);
    if (running && active) {
      const lead = Math.max(0, remainingMs - URGENT_LEAD_MS);
      const id = setTimeout(() => setUrgent(true), lead);
      return () => clearTimeout(id);
    }
  }, [timerKey, running, remainingMs, active]);

  return urgent;
}
