// Mobile-native card surface for Bid Club.
// Wine-tinted panel with a gold hairline border.
import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { colors } from '../theme';
import { scale } from '../lib/scale';

export interface SurfaceProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export default function Surface({ children, style }: SurfaceProps) {
  return (
    <View
      style={[
        {
          backgroundColor: 'rgba(46,23,32,0.6)',
          borderWidth: 1,
          borderColor: colors.goldBorder,
          borderRadius: 14,
          padding: scale(18),
        },
        // Caller overrides win.
        style,
      ]}
    >
      {children}
    </View>
  );
}
