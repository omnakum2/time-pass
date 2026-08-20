// Mobile-native button primitive for Bid Club.
// Fresh RN implementation (Pressable + Text) — not a port of the web CSS.
import React from 'react';
import { Pressable, Text, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { colors, radius, STATUS_COLORS } from '../theme';
import { scale } from '../lib/scale';

type Variant = 'primary' | 'secondary' | 'danger';
type Size = 'sm' | 'md';

export interface ButtonProps {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export default function Button({
  variant = 'primary',
  size = 'md',
  block,
  onPress,
  disabled,
  children,
  style,
}: ButtonProps) {
  // Per-variant background + label color.
  const variantContainer: ViewStyle =
    variant === 'secondary'
      ? { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.goldBorder }
      : variant === 'danger'
      ? { backgroundColor: STATUS_COLORS.danger }
      : { backgroundColor: colors.gold };

  const labelColor =
    variant === 'secondary' ? colors.cream : '#2E1720';
  const labelWeight: TextStyle['fontWeight'] =
    variant === 'primary' ? '800' : variant === 'danger' ? '800' : '600';

  // Size drives vertical padding + label size.
  const pad = size === 'sm' ? scale(8) : scale(12);
  const fontSize = size === 'sm' ? scale(13) : scale(16);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          borderRadius: radius,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: pad,
          paddingHorizontal: scale(16),
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        variantContainer,
        block ? { width: '100%', alignSelf: 'stretch' } : null,
        style,
      ]}
    >
      <Text style={{ color: labelColor, fontWeight: labelWeight, fontSize }}>
        {children}
      </Text>
    </Pressable>
  );
}
