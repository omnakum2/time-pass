// Bid Club — mobile-native TrumpPicker (inner content of a Popup; no Modal here).
// Fresh RN implementation (View/Text/Pressable + StyleSheet), not a web CSS port.
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { TRUMP_SPECIALS, SUIT_SYMBOL, SUIT_ORDER, isRedSuit } from 'shared';
import { sendMsg } from '../net/socket';
import { CountdownRing } from './CountdownRing';
import { colors, radius } from '../theme';
import { scale } from '../lib/scale';

interface Props {
  remainingMs: number;
  fullMs: number;
  startKey: string;
  running?: boolean;
  limited?: boolean;
}

/** Choose a trump suit or a special (No Trump, etc.). Up & Down (`limited`) offers only No Trump. */
export function TrumpPicker({ remainingMs, fullMs, startKey, running, limited }: Props) {
  const specials = limited ? TRUMP_SPECIALS.filter(o => o.kind === 'noTrump') : TRUMP_SPECIALS;
  return (
    <View>
      {/* Shared "Time left" header */}
      <View style={styles.timeRow}>
        <Text style={styles.timeLabel}>Time left:</Text>
        <CountdownRing remainingMs={remainingMs} fullMs={fullMs} startKey={startKey} running={running} />
      </View>

      {/* Suit buttons */}
      <View style={styles.suits}>
        {SUIT_ORDER.map(s => (
          <Pressable
            key={s}
            style={styles.suit}
            onPress={() => sendMsg({ type: 'selectTrump', kind: 'suit', suit: s })}
          >
            <Text style={[styles.suitSymbol, { color: isRedSuit(s) ? '#F0736C' : colors.cream }]}>
              {SUIT_SYMBOL[s]}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Special options (No Trump, etc.) */}
      <View style={styles.specials}>
        {specials.map(o => (
          <Pressable
            key={o.kind}
            style={styles.special}
            onPress={() => sendMsg({ type: 'selectTrump', kind: o.kind })}
          >
            <Text style={styles.specialLabel}>{o.label}</Text>
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
  suits: {
    flexDirection: 'row',
    gap: scale(8),
    justifyContent: 'center',
    marginTop: scale(12),
  },
  suit: {
    padding: scale(12),
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    minWidth: scale(52),
    alignItems: 'center',
  },
  suitSymbol: {
    fontSize: scale(26),
  },
  specials: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(8),
    justifyContent: 'center',
    marginTop: scale(12),
  },
  special: {
    padding: scale(10),
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.goldBorder,
  },
  specialLabel: {
    color: colors.cream,
    fontWeight: '700',
    fontSize: scale(14),
  },
});
