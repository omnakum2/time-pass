// Bid Club — mobile-native BidPanel (inner content of a Popup; no Modal here).
// Fresh RN implementation (View/Text/Pressable + StyleSheet), not a web CSS port.
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { sendMsg } from '../net/socket';
import { CountdownRing } from './CountdownRing';
import { colors, radius } from '../theme';
import { scale } from '../lib/scale';

interface Props {
  round: number;
  remainingMs: number;
  fullMs: number;
  startKey: string;
  running?: boolean;
}

/** Pick a bid from 0..round (inclusive); tapping a chip sends `placeBid`. */
export function BidPanel({ round, remainingMs, fullMs, startKey, running }: Props) {
  const bids = Array.from({ length: round + 1 }, (_, i) => i);
  return (
    <View>
      {/* Shared "Time left" header */}
      <View style={styles.timeRow}>
        <Text style={styles.timeLabel}>Time left:</Text>
        <CountdownRing remainingMs={remainingMs} fullMs={fullMs} startKey={startKey} running={running} />
      </View>

      {/* Wrapping row of bid chips */}
      <View style={styles.chips}>
        {bids.map(b => (
          <Pressable
            key={b}
            style={styles.chip}
            onPress={() => sendMsg({ type: 'placeBid', bid: b })}
          >
            <Text style={styles.chipText}>{b}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(12),
  },
  timeLabel: {
    color: colors.creamMuted,
    fontSize: scale(13),
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(8),
    justifyContent: 'center',
    marginTop: scale(12),
  },
  chip: {
    minWidth: scale(44),
    padding: scale(10),
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    alignItems: 'center',
  },
  chipText: {
    color: colors.cream,
    fontWeight: '700',
    fontSize: scale(16),
  },
});
