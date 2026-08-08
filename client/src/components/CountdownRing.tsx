import { useCountdown } from '../hooks/useCountdown';
import { timerColor } from '../lib/helpers';

interface Props {
  durationMs: number;
  startKey: string; // changes when the timer should reset
}

export function CountdownRing({ durationMs, startKey }: Props) {
  const { fraction, remaining } = useCountdown(durationMs, startKey);

  const size = 44;
  const strokeWidth = 4;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const dashoffset = circumference * fraction;
  const color = timerColor(fraction);

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
