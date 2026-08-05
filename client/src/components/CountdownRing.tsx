import { useEffect, useState } from 'react';

interface Props {
  durationMs: number;
  startKey: string; // changes when the timer should reset
}

export function CountdownRing({ durationMs, startKey }: Props) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    setElapsed(0);
    const start = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - start), 100);
    return () => clearInterval(id);
  }, [startKey]);

  const fraction = Math.min(elapsed / durationMs, 1);
  const remaining = Math.max(0, Math.ceil((durationMs - elapsed) / 1000));

  const size = 44;
  const strokeWidth = 4;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const dashoffset = circumference * fraction;
  const color = fraction < 0.6 ? '#43A047' : fraction < 0.85 ? '#FFB300' : '#E53935';

  return (
    <div className="countdown-ring" title={`${remaining}s`}>
      <svg width={size} height={size}>
        <circle className="countdown-ring__track" cx={size / 2} cy={size / 2} r={r} strokeWidth={strokeWidth} />
        <circle
          className="countdown-ring__fill"
          cx={size / 2} cy={size / 2} r={r}
          strokeWidth={strokeWidth}
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={dashoffset}
        />
      </svg>
      <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700, color }}>
        {remaining}
      </span>
    </div>
  );
}
