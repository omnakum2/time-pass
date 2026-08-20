// Client-side constants, grouped by concern. All *_MS values are milliseconds.
//   1. UI timings — toast / copy / bubble / countdown pacing.
//   2. Storage keys — persisted key names.
//   3. WebSocket / networking — reconnect backoff.
//   4. Confetti — winner-celebration palette.

// ─── 1. UI timings (ms) ──────────────────────────────────────────────────────
export const TOAST_DISMISS_MS = 4000;              // auto-dismiss an error toast
export const COPY_FEEDBACK_MS = 1500;              // "copied!" checkmark duration
export const BUBBLE_MS = 3500;                     // quick-chat bubble lifetime
export const URGENT_LEAD_MS = 6000;                // show the urgent turn warning this early
export const COUNTDOWN_TICK_MS = 1000;             // per-second countdown tick
export const RING_TICK_MS = 100;                   // countdown-ring animation tick
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h — anything older is certainly a dead room

// ─── 2. Storage keys ─────────────────────────────────────────────────────────
export const STORAGE_KEYS = {
  player: 'pcg.player',           // localStorage: saved display name
  session: 'pcg.session',         // localStorage: seat / session token
} as const;

// ─── 3. WebSocket / networking ───────────────────────────────────────────────
export const RECONNECT_BASE_MS = 1000;   // first reconnect backoff step
export const RECONNECT_MAX_MS = 10_000;  // cap on the reconnect backoff delay
export const RECONNECT_EXP_CAP = 4;      // cap on the backoff exponent in 2 ** n

// ─── 4. Confetti ─────────────────────────────────────────────────────────────
// Winner-celebration palette: the gold / cream winner accents plus green & red.
export const CONFETTI_COLORS: string[] = [
  '#E9B84A', // gold
  '#FBF6E9', // cream
  '#5FD07A', // green
  '#3EA55C', // deep green
  '#F0736C', // red
  '#D64B43', // deep red
];
