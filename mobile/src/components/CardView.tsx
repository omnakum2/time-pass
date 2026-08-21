// Mobile-native playing card for Bid Club.
// Fresh RN build (Pressable + Moti entrance) — NOT a port of web CSS.
import React from 'react';
import { Text, Pressable, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { MotiView } from 'moti';
import { useReducedMotion } from 'react-native-reanimated';
import { Card, SUIT_SYMBOL, isRedSuit } from 'shared';
import { colors } from '../theme';
import { scale, cardWidth, cardHeight } from '../lib/scale';

interface Props {
  card: Card;
  disabled?: boolean;
  selected?: boolean;
  played?: boolean;
  flyIn?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

// Suit ink — red suits vs black suits.
const RED = '#C0392B';
const BLACK = '#1A1A1A';

export function CardView({ card, disabled, selected, played, flyIn, onPress, style }: Props) {
  const reduce = useReducedMotion();
  const ink = isRedSuit(card.suit) ? RED : BLACK;
  const w = cardWidth();
  // Corner pip: rank stacked over suit; reused top-left and (rotated) bottom-right.
  const corner = `${card.rank}\n${SUIT_SYMBOL[card.suit]}`;

  // Entrance origin: reduced-motion fades only; flyIn slides up from below; the
  // default hand entrance keeps its subtle scale-in.
  const from = reduce
    ? { opacity: 0 }
    : flyIn
      ? { opacity: 0, translateY: scale(40), scale: 0.8 }
      : { opacity: 0, scale: 0.85 };

  return (
    <MotiView
      from={from}
      // `selected` lifts the card via translateY, animated by Moti alongside the
      // entrance scale to avoid a static-vs-animated transform clash.
      animate={{ opacity: 1, scale: 1, translateY: selected ? -scale(10) : 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
      style={[
        {
          width: w,
          height: cardHeight(),
          backgroundColor: '#FFFFFF',
          borderRadius: 8,
          borderWidth: selected ? 2 : 1,
          borderColor: selected ? colors.gold : '#d7d7d7',
          opacity: disabled ? 0.45 : 1,
        },
        style, // merged last so callers can override
      ]}
    >
      {/* Whole card is the press target; disabled/played cards are static. */}
      <Pressable
        onPress={disabled || played ? undefined : onPress}
        disabled={disabled || played}
        style={styles.fill}
      >
        <Text style={[styles.corner, styles.tl, { color: ink }]}>{corner}</Text>
        <Text style={{ fontSize: w * 0.5, color: ink }}>{SUIT_SYMBOL[card.suit]}</Text>
        <Text style={[styles.corner, styles.br, { color: ink }]}>{corner}</Text>
      </Pressable>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: {
    position: 'absolute',
    fontSize: scale(10),
    lineHeight: scale(11),
    fontWeight: '700',
  },
  tl: {
    top: scale(3),
    left: scale(5),
  },
  br: {
    bottom: scale(3),
    right: scale(5),
    transform: [{ rotate: '180deg' }],
  },
});
