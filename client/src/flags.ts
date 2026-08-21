// Client feature flags (V3).
//
// These gate not-yet-shippable UI behind a build-time env var so the code can
// land ahead of the dependency it needs.

// Rewarded-ad top-up. OFF by default: the "Watch ad for Coins" button stays
// hidden until a real ad SDK is wired up (there is no ad SDK yet — the button
// currently just sends `adReward`, a placeholder for the future SDK callback).
// Flip on with `VITE_AD_REWARD_ENABLED=true` in the client build env once an ad
// provider is integrated. The server also gates this (AD_REWARD_DISABLED).
export function isAdRewardEnabled(): boolean {
  return import.meta.env.VITE_AD_REWARD_ENABLED === 'true';
}
