// Gems + weekly-leaderboard shared constants and pure helpers (side-effect-free;
// safe on client + server). The conversion is one-way (Gems → Coins) in V3.

export const GEM_TO_COINS = 1000;     // 1 Gem = 1,000 Gold Coins (one-way conversion)
export const LEADERBOARD_SIZE = 100;  // top N rows shown on the weekly board

// Coins yielded by converting `gems` Gems (whole number; gems is an integer count).
export function coinsForGems(gems: number): number {
  return gems * GEM_TO_COINS;
}

// A conversion request is valid iff it's a whole number ≥ 1 and no more than held.
export function isValidGemAmount(gems: number, held: number): boolean {
  return Number.isInteger(gems) && gems >= 1 && gems <= held;
}
