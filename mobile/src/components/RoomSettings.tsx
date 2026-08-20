// Mobile-native room settings: player-count chips + game-mode cards.
// Fresh RN implementation (no web CSS ported). RN has no range <input>, so the
// player count is a wrapping row of tappable chips instead of a slider.
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { GAME_MODES, GameMode } from 'shared';
import { colors, radius } from '../theme';
import { scale } from '../lib/scale';

interface Props {
  maxPlayers: number;
  minPlayers: number; // Home passes 2
  mode: GameMode;
  onCommitMaxPlayers: (n: number) => void;
  onSelectMode: (m: GameMode) => void;
}

/** Shared create/lobby room settings: player-count chips (minPlayers..7) + mode picker. */
export function RoomSettings({ maxPlayers, minPlayers, mode, onCommitMaxPlayers, onSelectMode }: Props) {
  // Build the inclusive minPlayers..7 range of selectable player counts.
  const playerOptions: number[] = [];
  for (let n = minPlayers; n <= 7; n++) playerOptions.push(n);

  return (
    <View>
      {/* Players section */}
      <View style={styles.section}>
        <Text style={styles.label}>{`Number of players (${minPlayers}-7)`}</Text>
        <View style={styles.chipRow}>
          {playerOptions.map((n) => {
            const active = n === maxPlayers;
            return (
              <Pressable
                key={n}
                onPress={() => onCommitMaxPlayers(n)}
                style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
              >
                <Text style={active ? styles.chipTextActive : styles.chipTextInactive}>{n}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Game mode section */}
      <View style={styles.section}>
        <Text style={styles.label}>Game mode</Text>
        {GAME_MODES.map((m) => {
          const active = mode === m.id;
          return (
            <Pressable
              key={m.id}
              onPress={() => onSelectMode(m.id)}
              style={[styles.modeCard, active ? styles.modeCardActive : styles.modeCardInactive]}
            >
              <Text style={styles.modeLabel}>{m.label}</Text>
              <Text style={styles.modeDesc}>{m.desc}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Column spacing between the two sections (margin-based gap).
  section: {
    marginBottom: scale(20),
  },
  label: {
    color: colors.cream,
    fontWeight: '600',
    fontSize: scale(13),
    marginBottom: scale(8),
  },
  // Wrapping row of player-count chips.
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(8),
  },
  chip: {
    minWidth: scale(40),
    paddingVertical: scale(8),
    paddingHorizontal: scale(8),
    borderRadius: radius,
    borderWidth: 1,
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  chipInactive: {
    backgroundColor: 'transparent',
    borderColor: colors.goldBorder,
  },
  chipTextActive: {
    color: '#2E1720',
    fontWeight: '700',
  },
  chipTextInactive: {
    color: colors.cream,
  },
  // Full-width selectable mode card.
  modeCard: {
    marginBottom: scale(8),
    padding: scale(12),
    borderRadius: radius,
    borderWidth: 1,
  },
  modeCardActive: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(233,184,74,0.12)',
  },
  modeCardInactive: {
    borderColor: colors.goldBorder,
    backgroundColor: 'transparent',
  },
  modeLabel: {
    color: colors.cream,
    fontWeight: '700',
    fontSize: scale(15),
  },
  modeDesc: {
    color: colors.creamMuted,
    fontSize: scale(12),
    marginTop: 2,
  },
});
