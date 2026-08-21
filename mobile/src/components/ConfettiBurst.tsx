// Mobile-native winner confetti overlay for Bid Club.
// A self-contained, fire-once celebratory burst — fresh RN (Moti) build, NOT a
// port of the web canvas-confetti effect. Pieces are built once on mount and
// each falls from just above the top edge to just past the bottom while fading
// and spinning. Purely decorative: pointerEvents="none" so it never blocks taps.
import { useRef } from 'react';
import { View, Dimensions } from 'react-native';
import { MotiView } from 'moti';
import { CONFETTI_COLORS } from '../constants';
import { scale } from '../lib/scale';

interface Piece {
  x: number;        // start x (px across the screen)
  color: string;    // fill from the winner palette
  size: number;     // base width in px (height = size * 1.6)
  delay: number;    // stagger start (ms)
  duration: number; // fall time (ms)
  spin: number;     // total rotation over the fall (deg, ±)
}

const PIECE_COUNT = 40;

export function ConfettiBurst() {
  const { width, height } = Dimensions.get('window');

  // Build the pieces ONCE (ref, not state) so re-renders never reshuffle them —
  // Math.random is fine here (app code, not a pure render dependency).
  const piecesRef = useRef<Piece[] | null>(null);
  if (piecesRef.current == null) {
    piecesRef.current = Array.from({ length: PIECE_COUNT }, () => ({
      x: Math.random() * width,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      size: scale(6) + Math.random() * (scale(12) - scale(6)),
      delay: Math.random() * 400,
      duration: 2200 + Math.random() * 1200, // 2200..3400ms
      spin: (Math.random() < 0.5 ? -1 : 1) * 360,
    }));
  }
  const pieces = piecesRef.current;

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 300 }}
    >
      {pieces.map((p, i) => (
        <MotiView
          key={i}
          style={{
            position: 'absolute',
            left: p.x,
            top: -scale(20),
            width: p.size,
            height: p.size * 1.6,
            backgroundColor: p.color,
            borderRadius: 2,
          }}
          from={{ translateY: 0, opacity: 1, rotate: '0deg' }}
          animate={{ translateY: height + scale(40), opacity: 0, rotate: `${p.spin}deg` }}
          transition={{ type: 'timing', duration: p.duration, delay: p.delay, easing: undefined }}
        />
      ))}
    </View>
  );
}
