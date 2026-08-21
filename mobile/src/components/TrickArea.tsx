import { View, Text, StyleSheet } from 'react-native';
import { TrickCard, Player, GameMode, GAME_MODES, TrumpConfig, trumpLabel, SUIT_SYMBOL, SUIT_NAME, RED_SUITS } from 'shared';
import { CardView } from './CardView';
import { playerName } from '../lib/helpers';
import { colors } from '../theme';
import { scale } from '../lib/scale';

interface Props {
  trick: TrickCard[];
  players: Player[];
  round: number | null;
  status: string;
  trumpConfig: TrumpConfig | null;
  urgent: boolean;
  mode: GameMode;
}

/**
 * Mobile-native felt table center: round/trump badge chips, the played trick
 * cards, and a status line. Fresh RN layout — web CSS is not ported, and the
 * web hover InfoTooltip is intentionally dropped (no hover on touch).
 */
export function TrickArea({ trick, players, round, status, trumpConfig, urgent, mode }: Props) {
  const modeShort = GAME_MODES.find((m) => m.id === mode)?.short ?? '';
  const isSuitTrump = trumpConfig?.kind === 'suit' && !!trumpConfig.suit;

  return (
    <View style={styles.outer}>
      <View style={styles.felt}>
        {/* Faint embossed wordmark — painted first so it sits behind the content. */}
        <Text style={styles.watermark}>BID CLUB</Text>

        {/* Centered badges: round (+ mode short) and trump. */}
        <View style={styles.badges}>
          {round != null && (
            <View style={styles.chip}>
              <Text style={styles.chipStrong}>{`Round ${round}`}</Text>
              {!!modeShort && <Text style={styles.chipMuted}>{modeShort}</Text>}
            </View>
          )}

          <View style={styles.chip}>
            <Text style={styles.chipMuted}>Trump</Text>
            {isSuitTrump && trumpConfig ? (
              <Text
                style={[
                  styles.chipStrong,
                  { color: RED_SUITS.has(trumpConfig.suit!) ? '#F0736C' : '#fff' },
                ]}
              >
                {`${SUIT_SYMBOL[trumpConfig.suit!]} ${SUIT_NAME[trumpConfig.suit!]}`}
              </Text>
            ) : (
              <Text style={styles.chipNone}>{trumpConfig ? trumpLabel(trumpConfig) : '·'}</Text>
            )}
          </View>
        </View>

        {/* Played trick cards, each captioned with the player's name. */}
        <View style={styles.cards}>
          {trick.map(({ playerId, card }) => (
            <View key={`${playerId}-${card.id}`} style={styles.slot}>
              <Text style={styles.slotName}>{playerName(players, playerId)}</Text>
              <CardView card={card} played />
            </View>
          ))}
        </View>

        {!!status && (
          <Text style={[styles.status, { color: urgent ? '#F0736C' : '#fff' }]}>{status}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: scale(10),
  },
  felt: {
    width: '100%',
    minHeight: scale(200),
    backgroundColor: colors.tableGreen,
    borderWidth: 2,
    borderColor: colors.tableGreenEdge,
    borderRadius: scale(16),
    padding: scale(12),
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(10),
  },
  // Absolute + stretched so it centers behind the flow content.
  watermark: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.06)',
    fontSize: scale(28),
    fontWeight: '800',
    letterSpacing: 2,
  },
  badges: {
    flexDirection: 'row',
    gap: scale(8),
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  chip: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: scale(14),
    paddingHorizontal: scale(10),
    paddingVertical: scale(4),
    flexDirection: 'row',
    gap: scale(6),
  },
  chipStrong: {
    color: '#fff',
    fontWeight: '700',
    fontSize: scale(12),
  },
  chipMuted: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: scale(11),
  },
  chipNone: {
    color: '#fff',
    fontSize: scale(12),
  },
  cards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(10),
    justifyContent: 'center',
  },
  slot: {
    alignItems: 'center',
    gap: scale(2),
  },
  slotName: {
    color: '#fff',
    fontSize: scale(11),
  },
  status: {
    fontWeight: '700',
    fontSize: scale(14),
    textAlign: 'center',
    marginTop: scale(6),
  },
});
