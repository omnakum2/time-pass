// Mobile-native full scoreboard for Bid Club — a compact per-round matrix.
// Fresh RN build (View grid inside a horizontal ScrollView so many players fit),
// NOT a port of the web CSS table. Rows are keyed by SEQUENCE INDEX (not round
// number): modes that repeat a round number (e.g. Up & Down's 1..7..1) need
// every played round shown, and round numbers alone would collide.
import { GameState } from 'shared';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Delta } from './Delta';
import { colors } from '../theme';
import { scale } from '../lib/scale';

export function Scoreboard({ gameState }: { gameState: GameState }) {
  const { players, scoreboard } = gameState;

  // Row count = longest per-player history.
  const roundCount = players.reduce(
    (max, p) => Math.max(max, scoreboard[p.id]?.length ?? 0),
    0,
  );

  if (roundCount === 0) {
    return (
      <Text style={{ color: colors.creamMuted, textAlign: 'center', padding: scale(12) }}>
        Scores will appear here
      </Text>
    );
  }

  // Label for row i = the round number any player recorded at that index (fallback i+1).
  const roundLabel = (i: number) => {
    for (const p of players) {
      const row = scoreboard[p.id]?.[i];
      if (row) return row.round;
    }
    return i + 1;
  };

  // Last row's running total for a player (0 if they have no rows).
  const getTotal = (playerId: string) => {
    const rows = scoreboard[playerId] ?? [];
    return rows.length > 0 ? rows[rows.length - 1].total : 0;
  };

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View>
        {/* Header row: R | player names */}
        <View style={[styles.row, styles.headerRow]}>
          <Text style={[styles.cell, styles.labelCell, styles.headerText]}>R</Text>
          {players.map((p) => (
            <Text key={p.id} style={[styles.cell, styles.headerText]} numberOfLines={1}>
              {p.name}
            </Text>
          ))}
        </View>

        {/* One row per played round index */}
        {Array.from({ length: roundCount }, (_, i) => (
          <View key={i} style={styles.row}>
            <Text style={[styles.cell, styles.labelCell]}>R{roundLabel(i)}</Text>
            {players.map((p) => {
              const row = scoreboard[p.id]?.[i];
              return (
                <View key={p.id} style={styles.cell}>
                  {row ? (
                    <View style={styles.deltaWrap}>
                      <Delta value={row.delta} />
                      {row.multiplier > 1 ? (
                        <Text style={styles.mult}>×{row.multiplier}</Text>
                      ) : null}
                    </View>
                  ) : (
                    <Text style={styles.dash}>-</Text>
                  )}
                </View>
              );
            })}
          </View>
        ))}

        {/* Final totals */}
        <View style={[styles.row, styles.totalRow]}>
          <Text style={[styles.cell, styles.labelCell, styles.totalText]}>Total</Text>
          {players.map((p) => (
            <Text key={p.id} style={[styles.cell, styles.totalText]}>
              {getTotal(p.id)}
            </Text>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const COL_W = scale(56);
const LABEL_W = scale(46);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scale(5),
  },
  headerRow: {
    borderBottomWidth: 1,
    borderBottomColor: colors.goldBorder,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.goldBorder,
  },
  cell: {
    width: COL_W,
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    color: colors.cream,
    fontSize: scale(13),
  },
  labelCell: {
    width: LABEL_W,
    color: colors.creamMuted,
  },
  headerText: {
    color: colors.creamMuted,
    fontSize: scale(12),
    fontWeight: '700',
  },
  totalText: {
    color: colors.cream,
    fontWeight: '800',
  },
  deltaWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mult: {
    color: colors.gold,
    fontSize: scale(10),
    marginLeft: scale(2),
  },
  dash: {
    color: colors.creamMuted,
    fontSize: scale(13),
    textAlign: 'center',
  },
});
