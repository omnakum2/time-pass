import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { GAME_MODES } from 'shared';
import { colors, gradient, STATUS_COLORS } from './src/theme';
import { useGameStore } from './src/store/gameStore';
import { storage } from './src/storage';
import { connect, disconnect, startAppStateReconnect } from './src/net/socket';

// ─── Phase 1 plumbing-proof screen ─────────────────────────────────────────
// Not the game UI yet. This wires the ported plumbing end-to-end: it hydrates
// the persisted session, opens the live WebSocket to the game server, watches
// app foreground/background to reconnect, and reflects the store's `connected`
// flag — a visible proof that store + socket + storage + shared all work on
// device. GAME_MODES still comes straight from the workspace `shared` engine.

export default function App() {
  const connected = useGameStore((s) => s.connected);

  useEffect(() => {
    let stopAppState: (() => void) | undefined;
    // Hydrate the persisted session BEFORE connecting, so the socket's onopen can
    // synchronously restore our seat; then open the connection and start the
    // foreground-reconnect watcher.
    storage.hydrate().then(() => {
      connect();
      stopAppState = startAppStateReconnect();
    });
    return () => {
      stopAppState?.();
      disconnect();
    };
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <LinearGradient
          colors={[...gradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.root}
        >
          <SafeAreaView style={styles.safe}>
            <Animated.View entering={FadeInDown.duration(600)} style={styles.center}>
              <Text style={styles.logo}>Bid Club</Text>
              <Text style={styles.tag}>Android · portrait · React Native</Text>
            </Animated.View>

            <Animated.View entering={FadeIn.delay(300).duration(600)} style={styles.statusRow}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: connected ? STATUS_COLORS.success : STATUS_COLORS.warning },
                ]}
              />
              <Text style={styles.statusText}>
                {connected ? 'Connected to server' : 'Connecting…'}
              </Text>
            </Animated.View>

            <Animated.View entering={FadeIn.delay(500).duration(600)} style={styles.modesBox}>
              <Text style={styles.modesTitle}>
                {GAME_MODES.length} modes loaded from shared engine
              </Text>
              {GAME_MODES.map((m) => (
                <Text key={m.id} style={styles.mode}>
                  {m.label}
                </Text>
              ))}
            </Animated.View>
          </SafeAreaView>
          <StatusBar style="light" />
        </LinearGradient>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 36 },
  center: { alignItems: 'center', gap: 8 },
  logo: { fontSize: 44, fontWeight: '800', color: colors.gold, letterSpacing: 1 },
  tag: { fontSize: 14, color: colors.creamMuted },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontSize: 14, color: colors.cream, fontWeight: '600' },
  modesBox: {
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    backgroundColor: 'rgba(46,23,32,0.5)',
  },
  modesTitle: { fontSize: 13, color: colors.creamMuted, marginBottom: 4 },
  mode: { fontSize: 16, fontWeight: '700', color: colors.cream },
});
