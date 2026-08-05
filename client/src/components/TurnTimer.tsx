import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';

interface Props {
  durationMs: number;
}

export function TurnBorder({ durationMs }: Props) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - start), 100);
    return () => clearInterval(id);
  }, []);

  const fraction = Math.min(elapsed / durationMs, 1);
  const remaining = Math.max(0, (1 - fraction) * 100); // percent of ring remaining
  const color = fraction < 0.6 ? '#43A047' : fraction < 0.85 ? '#FFB300' : '#E53935';

  return (
    <div
      className="turn-border"
      aria-hidden
      style={{ '--turn-rp': `${remaining}%`, '--turn-color': color } as CSSProperties}
    />
  );
}
