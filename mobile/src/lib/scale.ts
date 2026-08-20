// Responsive sizing helpers for portrait phones.
// The web used clamp()/vw for fluid sizing, which React Native lacks — these
// reproduce that behavior against the live screen width. Dimensions are read
// at call time (not module load) so values stay correct after rotation/resize.
import { Dimensions } from 'react-native';

// Design guideline width (iPhone-class portrait).
const BASE_WIDTH = 375;

/**
 * Width-proportional scale of `size` vs the 375pt guideline.
 * The factor is clamped to [0.85, 1.3] so type/spacing don't blow up on large
 * phones or tablets. Result is rounded to the nearest 0.5.
 */
export function scale(size: number): number {
  const { width } = Dimensions.get('window');
  const factor = Math.min(1.3, Math.max(0.85, width / BASE_WIDTH));
  return Math.round(size * factor * 2) / 2;
}

/** Playing-card width — mirrors web `clamp(46px, 9vw, 72px)`. */
export function cardWidth(): number {
  const { width } = Dimensions.get('window');
  return Math.max(46, Math.min(72, width * 0.09));
}

/** Playing-card height — mirrors web `calc(card-w * 1.45)`. */
export function cardHeight(): number {
  return cardWidth() * 1.45;
}
