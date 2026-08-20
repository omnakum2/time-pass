import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NAME_MIN_LEN, NAME_MAX_LEN, GameMode } from 'shared';
import { sendMsg, reconnectSession } from '../net/socket';
import { useGameStore } from '../store/gameStore';
import { storage } from '../storage';
import { colors } from '../theme';
import { scale } from '../lib/scale';
import { Header } from '../components/Header';
import Button from '../components/Button';
import Field from '../components/Field';
import Surface from '../components/Surface';
import { RoomSettings } from '../components/RoomSettings';

// Home: landing → create / join. Navigation into the room is store-driven — once
// the server assigns us a roomId, RootNavigator swaps to the Room screen — so this
// screen only fires createRoom/joinRoom and never navigates imperatively.
export function HomePage() {
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(7);
  const [view, setView] = useState<'landing' | 'create' | 'join'>('landing');
  const [gameMode, setGameMode] = useState<GameMode>('classic');
  const [pending, setPending] = useState<'create' | 'join' | null>(null);
  const { connected, reconnectFailed } = useGameStore();
  const rejoinAttempt = useRef(false);

  // Prefill the saved display name (AsyncStorage is async).
  useEffect(() => {
    storage.getPlayer().then((p) => { if (p?.name) setName(p.name); });
  }, []);

  const saveName = useCallback(() => {
    const trimmed = name.trim().slice(0, NAME_MAX_LEN);
    if (!trimmed) return null;
    void storage.setPlayer({ name: trimmed });
    return trimmed;
  }, [name]);

  const fireCreate = useCallback(() => {
    const n = saveName();
    if (!n) return;
    sendMsg({ type: 'createRoom', name: n, maxPlayers, mode: gameMode });
  }, [saveName, maxPlayers, gameMode]);

  const fireJoin = useCallback(() => {
    const n = saveName();
    const code = roomCode.trim().toUpperCase();
    if (!n || !code) return;
    // Already hold a seat in this room (app was backgrounded/closed) → restore it
    // rather than joining as a newcomer, which a running game would reject.
    const session = storage.getCachedSession();
    if (session && session.roomId.toUpperCase() === code) {
      rejoinAttempt.current = true;
      reconnectSession(session.roomId, session.token);
    } else {
      sendMsg({ type: 'joinRoom', roomId: code, name: n });
    }
  }, [saveName, roomCode]);

  // Fire immediately when connected, else queue a single pending action.
  const handleCreate = () => {
    if (pending || name.trim().length < NAME_MIN_LEN) return;
    if (connected) fireCreate();
    else setPending('create');
  };
  const handleJoin = () => {
    if (pending || name.trim().length < NAME_MIN_LEN || !roomCode.trim()) return;
    if (connected) fireJoin();
    else setPending('join');
  };

  // Once the socket connects, run the queued action exactly once.
  useEffect(() => {
    if (!connected || !pending) return;
    if (pending === 'create') fireCreate();
    else fireJoin();
    setPending(null);
  }, [connected, pending, fireCreate, fireJoin]);

  // A rejoin that failed (room gone) — surface it instead of leaving the button spinning.
  useEffect(() => {
    if (!reconnectFailed) return;
    if (rejoinAttempt.current) {
      rejoinAttempt.current = false;
      setPending(null);
      useGameStore.getState().setError('ROOM_NOT_FOUND', 'That room is no longer available.');
    }
    useGameStore.getState().setReconnectFailed(false);
  }, [reconnectFailed]);

  const nameTooShort = name.trim().length < NAME_MIN_LEN;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <Header />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {view === 'landing' ? (
          <View style={styles.landing}>
            <Text style={styles.brand}>Bid Club</Text>
            <Text style={styles.blurb}>
              A real-time multiplayer trick-taking prediction game. Create a room, share the
              code, and invite 2–7 friends. Each round, predict exactly how many tricks you'll
              win — hit your number to score, miss it and lose points.
            </Text>
            <View style={styles.actions}>
              <Button variant="primary" onPress={() => setView('create')}>Start</Button>
              <Button variant="secondary" onPress={() => setView('join')}>Join Room</Button>
            </View>
          </View>
        ) : (
          <Surface style={styles.card}>
            <Text style={styles.cardTitle}>Bid Club</Text>
            <Field
              label="Your name"
              hint={`${NAME_MIN_LEN}-${NAME_MAX_LEN} characters`}
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              maxLength={NAME_MAX_LEN}
              autoFocus
              autoCapitalize="words"
              onSubmitEditing={view === 'create' ? handleCreate : handleJoin}
            />

            {view === 'create' && (
              <RoomSettings
                maxPlayers={maxPlayers}
                minPlayers={2}
                mode={gameMode}
                onCommitMaxPlayers={setMaxPlayers}
                onSelectMode={setGameMode}
              />
            )}

            {view === 'join' && (
              <Field
                label="Room code"
                value={roomCode}
                onChangeText={(t) => setRoomCode(t.toUpperCase())}
                placeholder="e.g. AB12CD"
                maxLength={6}
                autoCapitalize="characters"
                onSubmitEditing={handleJoin}
              />
            )}

            <View style={styles.formActions}>
              {view === 'create' ? (
                <Button variant="primary" onPress={handleCreate} disabled={pending !== null || nameTooShort}>
                  {pending === 'create' ? 'Starting…' : 'Create Room'}
                </Button>
              ) : (
                <Button
                  variant="primary"
                  onPress={handleJoin}
                  disabled={pending !== null || nameTooShort || !roomCode.trim()}
                >
                  {pending === 'join' ? 'Joining…' : 'Join'}
                </Button>
              )}
              <Button variant="secondary" onPress={() => setView('landing')}>Back</Button>
            </View>
          </Surface>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: scale(20), gap: scale(20) },
  landing: { alignItems: 'center', gap: scale(24) },
  brand: { fontSize: scale(40), fontWeight: '800', color: colors.gold, letterSpacing: 1 },
  blurb: { fontSize: scale(14), lineHeight: scale(21), color: colors.creamMuted, textAlign: 'center' },
  actions: { width: '100%', gap: scale(12), maxWidth: 400 },
  card: { width: '100%', maxWidth: 400, alignSelf: 'center', gap: scale(18) },
  cardTitle: { fontSize: scale(28), fontWeight: '800', color: colors.gold, textAlign: 'center' },
  formActions: { gap: scale(10) },
});
