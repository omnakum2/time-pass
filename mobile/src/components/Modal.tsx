// Mobile-native modal for Bid Club.
// Fresh RN build (RN Modal + Moti fade/scale) mirroring the web Modal's
// behavior — backdrop-dimmed, centered, dismissable — NOT a port of web CSS.
import React from 'react';
import { Modal as RNModal, Text, Pressable, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { colors } from '../theme';
import { scale } from '../lib/scale';
import Icon from './Icon';

interface Props {
  open: boolean;
  onClose?: () => void;
  title?: string;
  /** When true (default), backdrop tap closes and a close button is shown. */
  dismissable?: boolean;
  children: React.ReactNode;
}

/** One backdrop-dimmed, centered, fade/scale modal for every overlay. */
export function Modal({ open, onClose, title, dismissable = true, children }: Props) {
  return (
    <RNModal transparent visible={open} onRequestClose={onClose} animationType="fade">
      {/* Full-screen backdrop; a tap closes only when dismissable. */}
      <Pressable style={styles.backdrop} onPress={dismissable ? onClose : undefined}>
        {/* Fade/scale-in panel. The inner Pressable captures touches so a tap
            on the panel does NOT reach the backdrop (never self-closes). */}
        <MotiView
          style={styles.panelWrap}
          from={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Pressable style={styles.panel} onPress={() => {}}>
            {dismissable && onClose ? (
              <Pressable style={styles.close} onPress={onClose} hitSlop={8}>
                <Icon name="close" size={20} color={colors.creamMuted} />
              </Pressable>
            ) : null}
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {children}
          </Pressable>
        </MotiView>
      </Pressable>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelWrap: {
    width: '90%',
    maxWidth: 440,
  },
  panel: {
    backgroundColor: '#2E1720',
    borderWidth: 1,
    borderColor: colors.goldBorder,
    borderRadius: 16,
    padding: scale(20),
  },
  close: {
    position: 'absolute',
    top: scale(10),
    right: scale(10),
    zIndex: 1,
  },
  title: {
    color: colors.gold,
    fontWeight: '800',
    fontSize: scale(18),
    textAlign: 'center',
    marginBottom: scale(12),
  },
});
