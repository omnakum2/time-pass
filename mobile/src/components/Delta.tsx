import { useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { formatDelta } from '../lib/helpers';
import { STATUS_COLORS } from '../theme';

/** A signed, colored score delta: "+33" (green) / "-30" (red) / "0" (green).
 *  The number rolls from its previous value to the new one (~500ms) on change. */
export function Delta({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    if (reduce) {
      setDisplay(value);
      prev.current = value;
      return;
    }
    const from = prev.current;
    const to = value;
    prev.current = value;
    if (from === to) {
      setDisplay(to);
      return;
    }
    const DURATION = 500;
    const startedAt = Date.now();
    const id = setInterval(() => {
      const t = Math.min(1, (Date.now() - startedAt) / DURATION);
      setDisplay(Math.round(from + (to - from) * t));
      if (t >= 1) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [value, reduce]);

  return (
    <Text style={{ color: value >= 0 ? STATUS_COLORS.success : STATUS_COLORS.danger, fontWeight: '700' }}>
      {formatDelta(display)}
    </Text>
  );
}
