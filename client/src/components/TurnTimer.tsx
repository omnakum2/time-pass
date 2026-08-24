import type { CSSProperties } from 'react';
import { useCountdown } from '../hooks/useCountdown';
import { timerColor } from '../lib/helpers';

interface Props {
  remainingMs: number;
  fullMs: number;
  startKey: string;
  running?: boolean;
  expiresAt?: number | null;
}

export function TurnBorder({ remainingMs, fullMs, startKey, running = true, expiresAt }: Props) {
  const { fraction } = useCountdown(remainingMs, fullMs, startKey, running, expiresAt);

  const remaining = Math.max(0, (1 - fraction) * 100); // percent of ring remaining
  const color = timerColor(fraction);

  return (
    <div
      className="turn-border"
      aria-hidden
      style={{ '--turn-rp': `${remaining}%`, '--turn-color': color } as CSSProperties}
    />
  );
}
