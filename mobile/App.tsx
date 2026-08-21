import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { NavigationContainer, DarkTheme, type Theme } from '@react-navigation/native';
import { gradient, colors } from './src/theme';
import { scale } from './src/lib/scale';
import { storage } from './src/storage';
import { useGameStore } from './src/store/gameStore';
import { connect, disconnect, startAppStateReconnect } from './src/net/socket';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ErrorToast } from './src/components/ErrorToast';

// Transparent navigation theme so the app's wine gradient shows behind every
// screen; wine header/card + gold accents match the brand.
const navTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: 'transparent',
    card: '#2E1720',
    text: colors.cream,
    primary: colors.gold,
    border: colors.goldBorder,
  },
};

export default function App() {
  const roomClosed = useGameStore((s) => s.roomClosed);
  const gameOver = useGameStore((s) => s.gameOver);
  const connected = useGameStore((s) => s.connected);
  const roomId = useGameStore((s) => s.roomId);

  useEffect(() => {
    let stopAppState: (() => void) | undefined;
    // Hydrate the persisted session BEFORE connecting so the socket's onopen can
    // synchronously restore our seat; then open the connection + foreground watcher.
    storage.hydrate().then(() => {
      connect();
      stopAppState = startAppStateReconnect();
    });
    return () => {
      stopAppState?.();
      disconnect();
    };
  }, []);

  // A room that closes mid-lobby/game (not at game over — WinnerPage handles that
  // gracefully) drops us home with a one-off notice.
  useEffect(() => {
    if (roomClosed && !gameOver) {
      useGameStore.getState().setError('ROOM_CLOSED', 'The room was closed.');
      useGameStore.getState().reset();
    }
  }, [roomClosed, gameOver]);

  // Show a quiet "reconnecting" pill only when we hold a seat and the socket drops
  // (a mid-session disconnect) — not during the initial connect.
  const reconnecting = !connected && !!roomId;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <LinearGradient
          colors={[...gradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.root}
        >
          <NavigationContainer theme={navTheme}>
            <RootNavigator />
          </NavigationContainer>
          <ErrorToast />
          {reconnecting && (
            <View pointerEvents="none" style={styles.reconnect}>
              <Text style={styles.reconnectText}>Reconnecting…</Text>
            </View>
          )}
          <StatusBar style="light" />
        </LinearGradient>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  reconnect: {
    position: 'absolute',
    bottom: scale(24),
    alignSelf: 'center',
    backgroundColor: 'rgba(46,23,32,0.92)',
    borderColor: colors.goldBorder,
    borderWidth: 1,
    borderRadius: scale(16),
    paddingHorizontal: scale(14),
    paddingVertical: scale(6),
  },
  reconnectText: { color: colors.cream, fontSize: scale(12), fontWeight: '600' },
});
