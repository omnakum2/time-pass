// Mobile-native Lobby (Waiting Room) for Bid Club.
// Fresh RN screen (View/Text/ScrollView/Pressable + StyleSheet) — not a port of
// the web LobbyPage CSS. Sharing uses the native Share sheet (no clipboard/URLs).
import { useState } from 'react';
import { View, Text, ScrollView, Pressable, Share, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GAME_MODES } from 'shared';
import { useGameStore } from '../store/gameStore';
import { storage } from '../storage';
import { sendMsg } from '../net/socket';
import { useSecondsRemaining } from '../hooks/useSecondsRemaining';
import { colors, radius } from '../theme';
import { scale } from '../lib/scale';
import Surface from '../components/Surface';
import Button from '../components/Button';
import Icon from '../components/Icon';
import { RoomSettings } from '../components/RoomSettings';
import { PlayerList } from '../components/PlayerList';

export function LobbyPage() {
  const { gameState, playerId, roomId } = useGameStore();

  // Tick the server countdown locally. Called BEFORE the early return so the
  // hook order stays stable across the null → loaded transition (Rules of Hooks).
  const secondsLeft = useSecondsRemaining(gameState?.countdownMs ?? null);

  // Guard: nothing to show until the server has seeded room state + our id.
  if (!gameState || !playerId) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <Text style={styles.joining}>Joining room…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { players, hostId, maxPlayers, mode, countdownMs } = gameState;
  const isHost = hostId === playerId;
  const code = roomId ?? '';
  const modeLabel = GAME_MODES.find((m) => m.id === mode)?.label ?? '';

  // Invite via the native Share sheet — share the room code, not a URL.
  const shareCode = () => Share.share({ message: `Join my Bid Club room: ${code}` });

  // Leave: tell the server, drop the persisted session, and reset the store
  // (RootNavigator returns to Home once the store clears).
  const leave = () => {
    sendMsg({ type: 'leaveRoom' });
    void storage.clearSession();
    useGameStore.getState().reset();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Surface style={styles.card}>
          {/* 1. Header block: title, mode badge, code + share, hint, share button */}
          <View style={styles.header}>
            <Text style={styles.title}>Waiting Room</Text>

            {modeLabel ? (
              <View style={styles.modeBadge}>
                <Text style={styles.modeBadgeText}>{modeLabel}</Text>
              </View>
            ) : null}

            <View style={styles.codeRow}>
              <Text style={styles.code}>{code}</Text>
              <Pressable hitSlop={8} onPress={shareCode}>
                <Icon name="copy" size={scale(20)} color={colors.gold} />
              </Pressable>
            </View>

            <Text style={styles.hint}>Share this code for others to join</Text>

            <Button variant="secondary" onPress={shareCode}>
              Share code
            </Button>
          </View>

          {/* 2. Host controls, or a read-only summary for guests */}
          {isHost ? (
            <RoomSettings
              maxPlayers={maxPlayers}
              minPlayers={Math.max(2, players.length)}
              mode={mode}
              onCommitMaxPlayers={(n) => sendMsg({ type: 'updateRoomSettings', maxPlayers: n })}
              onSelectMode={(m) => sendMsg({ type: 'updateRoomSettings', mode: m })}
            />
          ) : (
            <Text style={styles.summary}>
              {`${modeLabel} · Players ${players.length}/${maxPlayers}`}
            </Text>
          )}

          {/* 3. Roster */}
          <PlayerList players={players} hostId={hostId} youId={playerId} maxPlayers={maxPlayers} />

          {/* 4. Status line: countdown while starting, else waiting message */}
          {countdownMs != null ? (
            <Text style={styles.starting}>{`Starting in ${secondsLeft ?? 0}…`}</Text>
          ) : (
            <Text style={styles.waiting}>
              {`Waiting for players (${players.length}/${maxPlayers})`}
            </Text>
          )}

          {/* 5. Host-only start (needs ≥2 players) */}
          {isHost && (
            <Button
              variant="primary"
              block
              onPress={() => sendMsg({ type: 'startGame' })}
              disabled={players.length < 2}
            >
              Start Game
            </Button>
          )}

          {/* 6. Everyone can leave */}
          <Button variant="secondary" onPress={leave}>
            Leave
          </Button>
        </Surface>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  joining: { color: colors.creamMuted },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: scale(20),
  },
  card: {
    gap: scale(16),
    maxWidth: 440,
    alignSelf: 'center',
    width: '100%',
  },
  header: { alignItems: 'center', gap: scale(8) },
  title: {
    color: colors.gold,
    fontSize: scale(22),
    fontWeight: '800',
    textAlign: 'center',
  },
  modeBadge: {
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: colors.goldBorder,
    borderRadius: scale(20),
    paddingHorizontal: scale(12),
    paddingVertical: scale(4),
  },
  modeBadgeText: {
    color: colors.cream,
    fontSize: scale(12),
    fontWeight: '700',
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(10),
  },
  code: {
    color: colors.cream,
    fontSize: scale(26),
    fontWeight: '800',
    letterSpacing: 4,
  },
  hint: {
    color: colors.creamMuted,
    fontSize: scale(12),
    textAlign: 'center',
  },
  summary: {
    color: colors.creamMuted,
    textAlign: 'center',
  },
  starting: {
    color: colors.gold,
    fontWeight: '700',
    textAlign: 'center',
  },
  waiting: {
    color: colors.creamMuted,
    textAlign: 'center',
  },
});
