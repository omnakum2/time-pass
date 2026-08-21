// Bid Club — mobile-native PushPanel (inner content of a Popup; no Modal here).
// Blind Bid: after the hand is revealed, LOCK the blind bid (x2) or PUSH it +1 (x3).
// Fresh RN implementation (View/Text/Pressable + StyleSheet), not a web CSS port.
import { View, Text, StyleSheet } from 'react-native';
import Button from './Button';
import { CountdownRing } from './CountdownRing';
import { colors } from '../theme';
import { scale } from '../lib/scale';

interface Props {
  bid: number;      // the player's blind bid
  cards: number;    // hand size this round (can't push past it)
  remainingMs: number;
  fullMs: number;
  startKey: string;
  running?: boolean;
  onDecide: (push: boolean) => void;
}

export function PushPanel({ bid, cards, remainingMs, fullMs, startKey, running, onDecide }: Props) {
  const canPush = bid < cards;
  return (
    <View>
      {/* Shared "Time left" header */}
      <View style={styles.timeRow}>
        <Text style={styles.timeLabel}>Time left:</Text>
        <CountdownRing remainingMs={remainingMs} fullMs={fullMs} startKey={startKey} running={running} />
      </View>

      <Text style={styles.hint}>
        {`Your blind bid is ${bid}. Lock it (×2), or push to ${bid + 1} (×3): bigger reward, bigger risk.`}
      </Text>

      <View style={styles.buttons}>
        <Button variant="primary" onPress={() => onDecide(false)}>{`Lock · ×2`}</Button>
        {canPush && (
          <Button variant="secondary" onPress={() => onDecide(true)}>{`Push to ${bid + 1} · ×3`}</Button>
        )}
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
  hint: {
    color: colors.cream,
    fontSize: scale(14),
    textAlign: 'center',
    marginVertical: scale(10),
  },
  buttons: {
    gap: scale(10),
  },
});
