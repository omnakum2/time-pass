// Coin Rush (currency mode) — pure, side-effect-free helpers shared by client +
// server: bet validation, the burned table fee, and the real-Coin payout schedule.
// The game's chip math itself reuses `scoreRound(bid, won)` from ./engine (the mode
// invents no new scoring); this module only covers the *coin* economy around it.

// ─── Tunable knobs (LOCKED defaults) ─────────────────────────────────────────
export const MIN_BET = 100;                 // minimum host-set coin betAmount
export const BET_MULTIPLE = 10;             // betAmount must be a multiple of this
export const TABLE_FEE_PCT = 0.1;           // per-player fee (10% of betAmount), burned = the sink
export const STARTING_CHIP_PRESETS = [100, 150, 200] as const;
export const DEFAULT_STARTING_CHIPS = 100;
export const JACKPOT_MIN_BID = 3;           // scoop the jackpot by exact-hitting a bid ≥ this

// Per-player table fee (burned). betAmount is a multiple of 10, so this is whole.
export function tableFee(betAmount: number): number {
  return Math.round(betAmount * TABLE_FEE_PCT);
}

// Coins a seat must hold to buy in: betAmount + fee.
export function buyInTotal(betAmount: number): number {
  return betAmount + tableFee(betAmount);
}

// A host-chosen betAmount is valid iff it's an integer ≥ MIN_BET and a multiple of BET_MULTIPLE.
export function isValidBet(betAmount: number): boolean {
  return Number.isInteger(betAmount) && betAmount >= MIN_BET && betAmount % BET_MULTIPLE === 0;
}

// A host-chosen starting-chip stack is valid iff it's one of the presets.
export function isValidStartingChips(chips: number): boolean {
  return (STARTING_CHIP_PRESETS as readonly number[]).includes(chips);
}

// Payout fractions by player count (each list sums to 1):
//   2 players  → winner-take-all;  3–7 players → 60 / 30 / 10 (top 3 paid).
export function payoutFractions(playerCount: number): number[] {
  if (playerCount <= 2) return [1];
  return [0.6, 0.3, 0.1];
}

/**
 * Real-Coin payouts by finishing order.
 *
 * `rankGroups` lists tie-groups in finishing order — each group is the set of
 * players tied at that position, who split their combined bracket share evenly.
 * (No ties → each group has one member.) `pool` is the sum of all betAmounts
 * (the fee is already burned, not in the pool).
 *
 * Because the pool is a multiple of 10 and the brackets are 60/30/10, exact
 * splits are whole numbers. If a *tie* split isn't divisible, the remainder is
 * handed to the earliest-listed members so the payouts always sum EXACTLY to the
 * pool — real Coins are never over- or under-paid.
 */
export function computePayouts(
  rankGroups: string[][],
  pool: number,
  playerCount: number,
): Record<string, number> {
  const fractions = payoutFractions(playerCount);
  // Per-position coin share (index 0 = 1st). Positions past the schedule pay 0.
  const positionShares = fractions.map((f) => Math.round(pool * f));
  const out: Record<string, number> = {};
  let pos = 0;
  for (const group of rankGroups) {
    // Combined coins across the positions this tie-group spans.
    let sum = 0;
    for (let i = 0; i < group.length; i++) sum += positionShares[pos + i] ?? 0;
    // Even split; any indivisible remainder goes to earliest members first.
    const base = Math.floor(sum / group.length);
    let remainder = sum - base * group.length;
    for (const id of group) {
      out[id] = base + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder--;
    }
    pos += group.length;
  }
  return out;
}
