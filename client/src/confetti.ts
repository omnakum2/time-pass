// Winner celebration confetti — shared by every game's game-over screen.

import { CONFETTI_COLORS } from './constants';

/**
 * Fire the winner celebration — an energetic, two-burst confetti pop (plus a small
 * delayed 2nd beat) for EVERYONE at game over (win or lose). Skipped for viewers who
 * prefer reduced motion. Callers own WHEN this fires (their effect + fire-once logic).
 */
export function fireWinnerConfetti(): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  import('canvas-confetti').then(({ default: confetti }) => {
    // Mixed shapes: the built-in square plus a hand-rolled triangle.
    const triangle = confetti.shapeFromPath({ path: 'M0 0 L10 0 L5 10 Z' });
    const base = {
      origin: { x: 0.5, y: 0.5 },
      colors: CONFETTI_COLORS,
      shapes: ['square' as const, triangle],
      gravity: 1,   // particles arc up, then fall naturally under gravity
      ticks: 300,   // linger ~2.5–3s (fuller & slower than a quick pop)
    };

    // GitHub-2FA-style celebratory pop: a focused burst that fans out wide and rains
    // down. Two layers vary particle size + speed; a small delayed pop adds a 2nd beat.
    confetti({ ...base, particleCount: 90, spread: 100, startVelocity: 55, scalar: 1.1 });
    confetti({ ...base, particleCount: 70, spread: 130, startVelocity: 45, scalar: 0.85 });
    setTimeout(() => {
      confetti({ ...base, particleCount: 50, spread: 120, startVelocity: 50, scalar: 1.0, origin: { x: 0.5, y: 0.45 } });
    }, 220);
  });
}
