// Global error toast for Bid Club (mobile-native).
// Reads `error`/`clearError` from the game store and mirrors the web toast's
// behavior — auto-dismiss + tap-to-dismiss — but with a fresh RN/Moti build
// (slide-down enter/exit), NOT a port of the web CSS.
import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MotiView, AnimatePresence } from 'moti';
import { useGameStore } from '../store/gameStore';
import { TOAST_DISMISS_MS } from '../constants';
import { STATUS_COLORS } from '../theme';
import { scale } from '../lib/scale';
import Icon from './Icon';

// Dark-wine ink used for text/icon on the danger (light-red) card.
const INK = '#2E1720';

export function ErrorToast() {
  const error = useGameStore((s) => s.error);
  const clearError = useGameStore((s) => s.clearError);

  // Auto-dismiss whenever a (new) error appears; clear the timer on change/unmount.
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(clearError, TOAST_DISMISS_MS);
    return () => clearTimeout(t);
  }, [error, clearError]);

  return (
    // AnimatePresence renders nothing when there is no error, and plays the
    // exit animation when `error` clears.
    <AnimatePresence>
      {error && (
        <MotiView
          style={styles.wrap}
          from={{ opacity: 0, translateY: -20 }}
          animate={{ opacity: 1, translateY: 0 }}
          exit={{ opacity: 0, translateY: -20 }}
          pointerEvents="box-none"
        >
          {/* Tapping the toast body dismisses too (mirrors the web). */}
          <Pressable style={styles.card} onPress={clearError}>
            <Text style={styles.msg} numberOfLines={3}>
              {error.message || 'Something went wrong.'}
            </Text>
            <Pressable
              onPress={clearError}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Dismiss"
              style={styles.close}
            >
              <Icon name="close" size={16} color={INK} />
            </Pressable>
          </Pressable>
        </MotiView>
      )}
    </AnimatePresence>
  );
}

const styles = StyleSheet.create({
  // Pinned near the top, above app chrome.
  wrap: {
    position: 'absolute',
    top: scale(48),
    left: scale(12),
    right: scale(12),
    zIndex: 100,
  },
  card: {
    backgroundColor: STATUS_COLORS.danger,
    borderRadius: 10,
    paddingVertical: scale(10),
    paddingHorizontal: scale(14),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  msg: {
    flex: 1,
    color: INK,
    fontWeight: '700',
  },
  close: {
    marginLeft: scale(10),
  },
});
