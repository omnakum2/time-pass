// Pre-game brand header for Bid Club (Home screen).
// Minimal wine bar with the brand wordmark + a Guide link. Fresh RN build
// (View/Text/Pressable + StyleSheet) — not a port of the web header CSS.
// In-game controls (Scoreboard/Leave) intentionally come in a later phase.
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme';
import { scale } from '../lib/scale';

export function Header() {
  const navigation = useNavigation<any>();

  return (
    <View style={styles.bar}>
      <Text style={styles.brand}>Bid Club</Text>
      <Pressable
        onPress={() => navigation.navigate('Guide')}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Open the guide"
      >
        <Text style={styles.guide}>Guide</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: 'rgba(30,15,20,0.96)',
    borderBottomWidth: 1,
    borderBottomColor: colors.goldBorder,
    paddingHorizontal: scale(16),
    paddingVertical: scale(10),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    color: colors.gold,
    fontWeight: '800',
    fontSize: scale(20),
    letterSpacing: 0.5,
  },
  guide: {
    color: colors.cream,
    fontWeight: '700',
    fontSize: scale(14),
  },
});
