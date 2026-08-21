// Phase 6 "engagement track" — tunable constants + pure helpers (side-effect-free;
// client + server). Four features: win-streak bonus, first-win-of-day bonus,
// referral invites, and an (ad-SDK-gated) rewarded-ad top-up.

// ─── First-win-of-the-day ────────────────────────────────────────────────────
// Bonus Coins on a player's FIRST Coin Rush win each IST day (on top of the pool payout).
export const FIRST_WIN_BONUS = 100;

// ─── Daily-login win-streak bonus ────────────────────────────────────────────
// Consecutive Coin Rush wins boost the daily-login reward by an additive, capped
// amount (a nudge, not a faucet). Streak lives in stats.winStreak (server-tracked).
export const WIN_STREAK_BONUS_PER = 10; // Coins per streak level
export const WIN_STREAK_BONUS_CAP = 7;  // levels counted (so the max bonus is +70)
export function winStreakBonusCoins(winStreak: number): number {
  return Math.max(0, Math.min(winStreak, WIN_STREAK_BONUS_CAP)) * WIN_STREAK_BONUS_PER;
}

// ─── Referral invites ────────────────────────────────────────────────────────
// One-time, both-sides reward when a new player applies someone's code.
export const REFERRAL_REWARD = 500;      // Coins to BOTH referrer and referee
export const REFERRAL_CODE_LENGTH = 6;   // server-generated, 6 uppercase alphanumerics
// Validate a code's SHAPE client-side before sending (existence is checked server-side).
export function isValidReferralCodeShape(code: string): boolean {
  return typeof code === 'string' && new RegExp(`^[A-Z0-9]{${REFERRAL_CODE_LENGTH}}$`).test(code);
}
// Normalise user-typed codes (trim + uppercase) so "abc123 " matches "ABC123".
export function normalizeReferralCode(code: string): string {
  return (code ?? '').trim().toUpperCase();
}

// ─── Rewarded-ad top-up (ad-SDK-gated) ───────────────────────────────────────
// Disabled until a real ad SDK is wired (server env flag + client feature flag).
export const AD_REWARD_COINS = 50;
export const AD_REWARDS_PER_DAY = 5;
