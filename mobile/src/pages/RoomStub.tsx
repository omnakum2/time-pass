import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore } from '../store/gameStore';
import { sendMsg } from '../net/socket';
import { storage } from '../storage';
import { colors } from '../theme';
import { scale } from '../lib/scale';
import Button from '../components/Button';
import Surface from '../components/Surface';

// Phase 2 placeholder for the in-room experience. Proves create/join lands us in
// a room (store-driven navigation). The real Lobby/Game/Winner screens replace
// this in Phases 3/4/6. Leave resets the store → RootNavigator returns to Home.
export function RoomStub() {
  const { roomId, gameState } = useGameStore();
  const phase = gameState?.phase ?? 'LOBBY';
  const players = gameState?.players ?? [];

  const leave = () => {
    sendMsg({ type: 'leaveRoom' });
    void storage.clearSession();
    useGameStore.getState().reset();
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.center}>
        <Surface style={styles.card}>
          <Text style={styles.title}>You're in a room</Text>
          <Row label="Room code" value={roomId ?? '—'} />
          <Row label="Phase" value={phase} />
          <Row label="Players" value={String(players.length)} />
          {players.length > 0 && (
            <Text style={styles.names}>{players.map((p) => p.name).join(' · ')}</Text>
          )}
          <Text style={styles.note}>Lobby UI arrives in Phase 3.</Text>
          <Button variant="danger" onPress={leave}>Leave room</Button>
        </Surface>
      </View>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', padding: scale(20) },
  card: { gap: scale(12), maxWidth: 400, width: '100%', alignSelf: 'center' },
  title: { fontSize: scale(22), fontWeight: '800', color: colors.gold, textAlign: 'center', marginBottom: scale(4) },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { color: colors.creamMuted, fontSize: scale(14) },
  rowValue: { color: colors.cream, fontSize: scale(14), fontWeight: '700' },
  names: { color: colors.cream, fontSize: scale(13), textAlign: 'center' },
  note: { color: colors.creamMuted, fontSize: scale(12), textAlign: 'center', marginVertical: scale(6) },
});
