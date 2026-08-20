export interface SpinPrize { coins: number; gems: number; }
export interface SpinSegment { prize: SpinPrize; weight: number; } // weight = percent

// 8 segments (LOCKED). Coin EV ≈ 30 so paid spins sink; a Gem lands ~6%.
export const SPIN_SEGMENTS: SpinSegment[] = [
  { prize: { coins: 10, gems: 0 }, weight: 27 },
  { prize: { coins: 20, gems: 0 }, weight: 22 },
  { prize: { coins: 30, gems: 0 }, weight: 18 },
  { prize: { coins: 50, gems: 0 }, weight: 13 },
  { prize: { coins: 80, gems: 0 }, weight: 8 },
  { prize: { coins: 100, gems: 0 }, weight: 6 },
  { prize: { coins: 0, gems: 1 }, weight: 4 },
  { prize: { coins: 0, gems: 5 }, weight: 2 },
];

export const MAX_SPINS_PER_DAY = 3;
export const SPIN_COSTS = [0, 50, 150]; // cost of the 1st / 2nd / 3rd spin of the day

// Cost of the NEXT spin given how many were used today; null when none remain (>=3).
export function spinCost(usedToday: number): number | null {
  return usedToday < MAX_SPINS_PER_DAY ? SPIN_COSTS[usedToday] : null;
}

// Weighted draw. `rand` in [0,1) (server passes a crypto rng; tests pass fixed values).
// Walk cumulative weights (sum = 100); pick the first segment whose cumulative
// weight/100 exceeds `rand`; return its prize + index. Clamp rand into [0,1).
export function drawSpin(rand: number): { prize: SpinPrize; index: number } {
  let r = rand;
  if (!(r >= 0)) r = 0; // handles NaN and negatives
  if (r >= 1) r = 1 - Number.EPSILON;

  let cumulative = 0;
  for (let i = 0; i < SPIN_SEGMENTS.length; i++) {
    cumulative += SPIN_SEGMENTS[i].weight;
    if (cumulative / 100 > r) {
      return { prize: SPIN_SEGMENTS[i].prize, index: i };
    }
  }

  const last = SPIN_SEGMENTS.length - 1;
  return { prize: SPIN_SEGMENTS[last].prize, index: last };
}
