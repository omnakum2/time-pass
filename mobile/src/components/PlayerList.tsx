import { View, Text, StyleSheet } from 'react-native';
import type { Player } from 'shared';
import { colors } from '../theme';
import { scale } from '../lib/scale';

interface Props {
  players: Player[];
  hostId: string;
  youId: string;
  maxPlayers: number;
}

/** Mobile-native roster: header count + one row per player with host/you/status tags. */
export function PlayerList({ players, hostId, youId, maxPlayers }: Props) {
  return (
    <View>
      <Text style={styles.header}>
        Players ({players.length}/{maxPlayers})
      </Text>

      <View>
        {players.map((player) => (
          <View key={player.id} style={styles.row}>
            {/* flex:1 name pushes trailing badges/labels to the right edge */}
            <Text style={styles.name}>{player.name}</Text>

            {player.id === hostId && (
              <View style={styles.hostBadge}>
                <Text style={styles.hostBadgeText}>HOST</Text>
              </View>
            )}

            {player.id === youId && <Text style={styles.you}>(you)</Text>}

            {player.status === 'reconnecting' && (
              <Text style={styles.status}>reconnecting…</Text>
            )}

            {player.status === 'offline' && (
              <Text style={styles.status}>disconnected</Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    color: colors.creamMuted,
    fontSize: scale(13),
    fontWeight: '600',
    marginBottom: scale(8),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    paddingVertical: scale(10),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(233,184,74,0.15)',
  },
  name: {
    flex: 1,
    color: colors.cream,
    fontSize: scale(15),
    fontWeight: '600',
  },
  hostBadge: {
    backgroundColor: colors.gold,
    borderRadius: scale(4),
    paddingHorizontal: scale(6),
    paddingVertical: scale(2),
  },
  hostBadgeText: {
    color: '#2E1720',
    fontSize: scale(10),
    fontWeight: '800',
  },
  you: {
    color: colors.creamMuted,
    fontSize: scale(12),
  },
  status: {
    color: colors.creamMuted,
    fontSize: scale(11),
    fontStyle: 'italic',
  },
});
