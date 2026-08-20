import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { NavigationContainer, DarkTheme, type Theme } from '@react-navigation/native';
import { gradient, colors } from './src/theme';
import { storage } from './src/storage';
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
          <StatusBar style="light" />
        </LinearGradient>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
