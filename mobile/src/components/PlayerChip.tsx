// Mobile-native PlayerChip HUD for Bid Club.
// Compact per-player card: name, live turn ring, bid/tricks, score + push
// marker, and connection status. Ported behavior from web PlayerChip.tsx;
// styling is fresh RN (View/Text), NOT ported CSS.
import React from 'react';
import { View, Text } from 'react-native';
import { MotiView } from 'moti';
import { useReducedMotion } from 'react-native-reanimated';
import { Player } from 'shared';
import { useGameStore } from '../store/gameStore';
import { Delta } from './Delta';
import { CountdownRing } from './CountdownRing';
import { colors, radius } from '../theme';
import { scale } from '../lib/scale';

interface Props {
  player: Player;
  bid: number | null;
  tricksWon: number;
  isActive: boolean;
  phase: string;
  remainingMs?: number;
  fullMs?: number;
  startKey?: string;
  running?: boolean;
  isMe?: boolean;
  totalScore?: number;
  pushChoice?: 'locked' | 'pushed';
}

export function PlayerChip({
  player,
  bid,
  tricksWon,
  isActive,
  phase,
  remainingMs,
  fullMs,
  startKey,
  running,
  isMe,
  totalScore,
  pushChoice,
}: Props) {
  const bubble = useGameStore((s) => s.activeBubbles[player.id]);
  const reduce = useReducedMotion();

  // Turn ring shows on your PLAYING turn, or on others' BIDDING/TRUMP_SELECT turns.
  const showRing =
    isActive &&
    fullMs !== undefined &&
    (phase === 'PLAYING' ||
      ((phase === 'BIDDING' || phase === 'TRUMP_SELECT') && !isMe));

  const statsText =
    `${bid !== null ? 'Bid ' + bid : phase === 'BIDDING' ? 'bidding…' : 'no bid'}` +
    ` · Won ${tricksWon}`;

  const pushMarker =
    pushChoice === 'locked' ? '×2' : pushChoice === 'pushed' ? '×3' : '?';

  return (
    <View
      style={{
        // View is position:relative by default, so the absolute bubble anchors here.
        backgroundColor: isMe ? 'rgba(233,184,74,0.10)' : 'rgba(46,23,32,0.6)',
        borderWidth: 1,
        borderColor: isActive ? colors.gold : colors.goldBorder,
        borderRadius: radius,
        padding: scale(8),
        gap: scale(2),
        minWidth: scale(96),
        alignItems: 'center',
      }}
    >
      {/* Active-turn gold aura: pulsing overlay behind the content. Non-layout,
          non-interactive, and gated on reduced motion. */}
      {isActive && !reduce && (
        <MotiView
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -2,
            left: -2,
            right: -2,
            bottom: -2,
            borderRadius: radius + 2,
            borderWidth: 2,
            borderColor: colors.gold,
          }}
          from={{ opacity: 0.25 }}
          animate={{ opacity: 0.9 }}
          transition={{ loop: true, repeatReverse: true, type: 'timing', duration: 850 }}
        />
      )}

      {/* Quick-chat bubble floating above the card. Keyed so a new message remounts. */}
      {bubble && (
        <View
          key={bubble.key}
          style={{
            position: 'absolute',
            top: -scale(28),
            backgroundColor: colors.gold,
            borderRadius: scale(8),
            paddingHorizontal: scale(8),
            paddingVertical: scale(3),
          }}
        >
          <Text style={{ color: '#2E1720', fontSize: scale(11), fontWeight: '700' }}>
            {bubble.text}
          </Text>
        </View>
      )}

      {/* Name (+ faint "(you)" for the local player). */}
      <Text style={{ color: colors.cream, fontWeight: '700', fontSize: scale(13) }}>
        {player.name}
        {isMe && (
          <Text style={{ color: colors.creamMuted, fontSize: scale(11) }}> (you)</Text>
        )}
      </Text>

      {/* Active-turn countdown ring. */}
      {showRing && (
        <CountdownRing
          remainingMs={remainingMs ?? 0}
          fullMs={fullMs}
          startKey={startKey ?? ''}
          running={running}
        />
      )}

      {/* Bid + tricks-won summary. */}
      <Text style={{ color: colors.creamMuted, fontSize: scale(12) }}>{statsText}</Text>

      {/* Running score with animated Delta, plus optional push (×2/×3/?) marker. */}
      {totalScore !== undefined && (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ color: colors.creamMuted, fontSize: scale(12) }}>Score: </Text>
          <Delta value={totalScore} />
          {(phase === 'PUSH' || pushChoice) && (
            <Text style={{ color: colors.gold, fontSize: scale(12) }}>{` · ${pushMarker}`}</Text>
          )}
        </View>
      )}

      {/* Connection status when not fully online. */}
      {player.status !== 'online' && (
        <Text
          style={{ color: colors.creamMuted, fontSize: scale(11), fontStyle: 'italic' }}
        >
          {player.status === 'reconnecting' ? 'reconnecting…' : 'disconnected'}
        </Text>
      )}
    </View>
  );
}
