// Small formatting helpers shared across the client.

/** Ordinal label for a positive integer: 1 → "1st", 2 → "2nd", 3 → "3rd", 11 → "11th"… */
export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}
