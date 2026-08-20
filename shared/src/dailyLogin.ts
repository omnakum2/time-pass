// Pure daily-login-streak reward logic (side-effect-free).
// The IST day boundary is handled by the caller — this module only compares
// 'YYYY-MM-DD' date strings that are passed in.

export interface DailyReward {
  coins: number;
  gems: number;
}

// 7-day streak reward curve (LOCKED). Index 1..7 (index 0 unused).
// D1 25c · D2 50c · D3 75c · D4 100c · D5 150c · D6 200c · D7 = 5 Gems.
export const LOGIN_REWARDS: DailyReward[] = [
  { coins: 0, gems: 0 },   // [0] unused
  { coins: 25, gems: 0 },  // D1
  { coins: 50, gems: 0 },  // D2
  { coins: 75, gems: 0 },  // D3
  { coins: 100, gems: 0 }, // D4
  { coins: 150, gems: 0 }, // D5
  { coins: 200, gems: 0 }, // D6
  { coins: 0, gems: 5 },   // D7
];

// 'YYYY-MM-DD' minus one calendar day (pure; parse as UTC to avoid tz drift).
export function yesterday(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  const prev = new Date(d.getTime() - 86400000);
  return prev.toISOString().slice(0, 10);
}

// Resolve a daily claim. `today` and `lastClaimDate` are 'YYYY-MM-DD' (IST) strings.
export function claimDaily(
  lastClaimDate: string | null,
  streak: number,
  today: string
): { claimed: boolean; newStreak: number; reward: DailyReward } {
  if (lastClaimDate === today) {
    // Already claimed today — no-op.
    return { claimed: false, newStreak: streak, reward: { coins: 0, gems: 0 } };
  }

  const newStreak = lastClaimDate === yesterday(today) ? Math.min(streak + 1, 7) : 1;
  const reward = LOGIN_REWARDS[newStreak];

  return { claimed: true, newStreak, reward };
}
