import { Text } from 'react-native';
import { formatDelta } from '../lib/helpers';
import { STATUS_COLORS } from '../theme';

/** A signed, colored score delta: "+33" (green) / "-30" (red) / "0" (green). */
export function Delta({ value }: { value: number }) {
  return (
    <Text style={{ color: value >= 0 ? STATUS_COLORS.success : STATUS_COLORS.danger, fontWeight: '700' }}>
      {formatDelta(value)}
    </Text>
  );
}
