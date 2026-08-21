// Mobile-native game-over / winner screen for Bid Club.
// Ported from the web WinnerPage — same behavior, fresh RN layout. Leaving is
// store-driven (no navigation import): reset() clears roomId, and RootNavigator
// then returns Home on its own.
import { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useReducedMotion } from 'react-native-reanimated';
import { useGameStore } from '../store/gameStore';
import { sendMsg } from '../net/socket';
import { storage } from '../storage';
import { useSecondsRemaining } from '../hooks/useSecondsRemaining';
import { StandingsTable } from '../components/StandingsTable';
import { Delta } from '../components/Delta';
import Button from '../components/Button';
import Surface from '../components/Surface';
import { Modal } from '../components/Modal';
import Icon from '../components/Icon';
import { ConfettiBurst } from '../components/ConfettiBurst';
import { Scoreboard } from '../components/Scoreboard';
import { colors } from '../theme';
import { scale } from '../lib/scale';

export function WinnerPage() {
  const { gameOver, playerId, gameState, reset, roomClosed } = useGameStore();
  const reduce = useReducedMotion();
  const [boardOpen, setBoardOpen] = useState(false);

  const isHost = gameState?.hostId === playerId;

  // Track the first real host we ever see on this screen. If the host leaves a
  // finished game, the server promotes another player and broadcasts a new
  // hostId — we compare against this to detect that mid-screen change.
  const currentHostId = gameState?.hostId;
  const initialHostIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (initialHostIdRef.current == null && currentHostId) {
      initialHostIdRef.current = currentHostId;
    }
  }, [currentHostId]);
  const initialHostId = initialHostIdRef.current;
  const hostChanged = initialHostId != null && currentHostId !== initialHostId;

  const hasWinners = !!gameOver && gameOver.winners.length > 0;

  // Host-only expiry countdown — seeded from the server value, ticked down
  // locally each second. Hidden once the room has actually closed.
  const secsLeft = useSecondsRemaining(roomClosed ? null : (gameState?.roomExpiresInMs ?? null));

  if (!gameOver) {
    return (
      <SafeAreaView style={styles.loading} edges={['top', 'bottom']}>
        <Text style={styles.loadingText}>Loading…</Text>
      </SafeAreaView>
    );
  }

  const { winners, finalScores, playerNames } = gameOver;
  const isWinner = winners.includes(playerId ?? '');

  // Sort by score descending (handles all-negative scores correctly).
  const sortedPlayers = Object.entries(finalScores)
    .sort(([, a], [, b]) => b - a)
    .map(([id, score]) => ({ id, score, name: playerNames[id] ?? id }));

  const winnerNames = winners.map((id) => playerNames[id] ?? id);

  const handleRematch = () => sendMsg({ type: 'restartGame' });
  const handleLeave = () => {
    sendMsg({ type: 'leaveRoom' }); // release our seat server-side before leaving
    void storage.clearSession();
    reset();
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      {/* Celebratory burst for EVERYONE at game over (win or lose); skipped for reduced motion. */}
      {hasWinners && !reduce ? <ConfettiBurst /> : null}

      <ScrollView contentContainerStyle={styles.scroll}>
        <Surface style={styles.card}>
          {/* Trophy / party icon */}
          <Text style={styles.emoji}>{isWinner ? '🏆' : '🎉'}</Text>

          {/* Headline */}
          <Text style={styles.headline}>
            {isWinner
              ? 'You win!'
              : `${winnerNames.join(' & ')} win${winners.length > 1 ? '!' : 's!'}`}
          </Text>

          {/* Full standings */}
          <View style={styles.tableWrap}>
            <StandingsTable
              headers={['Player', 'Score']}
              rows={sortedPlayers.map((p, i) => ({
                key: p.id,
                highlight: winners.includes(p.id),
                cells: [
                  `${p.name}${i === 0 ? ' 🥇' : i === 1 ? ' 🥈' : i === 2 ? ' 🥉' : ''}${
                    p.id === playerId ? ' (you)' : ''
                  }`,
                  <Delta value={p.score} />,
                ],
              }))}
            />
          </View>

          {gameState ? (
            <Pressable style={styles.boardBtn} onPress={() => setBoardOpen(true)}>
              <Icon name="table" size={15} color={colors.cream} />
              <Text style={styles.boardBtnText}>Full scoreboard</Text>
            </Pressable>
          ) : null}

          {/* Controls */}
          {roomClosed ? (
            <>
              <Text style={styles.hint}>This game has ended and the room has closed.</Text>
              <Button variant="primary" block onPress={() => reset()}>
                Back to Home
              </Button>
            </>
          ) : isHost ? (
            <>
              {hostChanged ? (
                <Text style={styles.hint}>The previous host left, so you're the host now.</Text>
              ) : null}
              {secsLeft != null ? (
                <Text style={styles.faint}>Room closes in {secsLeft}s</Text>
              ) : null}
              <Button variant="primary" block onPress={handleRematch}>
                Play Again
              </Button>
              <Button variant="secondary" block onPress={handleLeave}>
                Leave
              </Button>
            </>
          ) : (
            <>
              <Text style={styles.hint}>Waiting for the host to start a rematch…</Text>
              <Button variant="secondary" block onPress={handleLeave}>
                Leave
              </Button>
            </>
          )}
        </Surface>
      </ScrollView>

      {gameState ? (
        <Modal open={boardOpen} onClose={() => setBoardOpen(false)} title="Scoreboard">
          <Scoreboard gameState={gameState} />
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: colors.cream,
    fontSize: scale(16),
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: scale(16),
  },
  card: {
    gap: scale(14),
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
    alignItems: 'center',
  },
  emoji: {
    fontSize: scale(56),
    lineHeight: scale(64),
  },
  headline: {
    color: colors.gold,
    fontWeight: '800',
    fontSize: scale(24),
    textAlign: 'center',
  },
  tableWrap: {
    width: '100%',
  },
  boardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(6),
    paddingVertical: scale(4),
  },
  boardBtnText: {
    color: colors.cream,
    fontSize: scale(14),
    fontWeight: '600',
  },
  hint: {
    color: colors.creamMuted,
    fontSize: scale(13),
    textAlign: 'center',
  },
  faint: {
    color: colors.creamMuted,
    fontSize: scale(12),
    textAlign: 'center',
  },
});
