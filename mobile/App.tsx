import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { GAME_MODES } from 'shared';

// ─── Phase 0 smoke screen ──────────────────────────────────────────────────
// Verifies the whole native stack renders in Expo Go: expo-linear-gradient,
// safe-area-context, Reanimated entrance animations, AND that the `shared`
// rules package resolves through the monorepo Metro config (GAME_MODES is
// imported straight from the workspace `shared` — same source as the web app).

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <LinearGradient
          colors={['#3B1F1B', '#5A2233', '#7A3B1E']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.root}
        >
          <SafeAreaView style={styles.safe}>
            <Animated.View entering={FadeInDown.duration(600)} style={styles.center}>
              <Text style={styles.logo}>Bid Club</Text>
              <Text style={styles.tag}>Android · portrait · React Native</Text>
            </Animated.View>

            <Animated.View entering={FadeIn.delay(400).duration(600)} style={styles.modesBox}>
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

const GOLD = '#E9B84A';
const CREAM = '#F3ECDD';

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 40 },
  center: { alignItems: 'center', gap: 8 },
  logo: { fontSize: 44, fontWeight: '800', color: GOLD, letterSpacing: 1 },
  tag: { fontSize: 14, color: 'rgba(243,236,221,0.6)' },
  modesBox: {
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(233,184,74,0.38)',
    backgroundColor: 'rgba(46,23,32,0.5)',
  },
  modesTitle: { fontSize: 13, color: 'rgba(243,236,221,0.6)', marginBottom: 4 },
  mode: { fontSize: 16, fontWeight: '700', color: CREAM },
});
