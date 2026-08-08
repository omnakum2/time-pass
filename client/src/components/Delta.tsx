import { formatDelta, deltaClass } from '../lib/helpers';

/** A signed, colored score delta: "+33" (green) / "-30" (red) / "0". */
export function Delta({ value }: { value: number }) {
  return <span className={deltaClass(value)}>{formatDelta(value)}</span>;
}
