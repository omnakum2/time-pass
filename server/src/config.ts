// Application behaviour constants — values that define how the game plays and
// protects itself, independent of the deployment environment.
//
// Environment-specific settings (port, allowed origins, URLs, secrets) do NOT
// belong here — they live in env.ts, loaded from process.env via dotenv.
//
// All *_MS values are milliseconds.

export const config = {
  // ─── Abuse / payload limits ────────────────────────────────
  maxPayloadBytes: 8192, // inbound WebSocket message cap (messages are tiny)
  maxConnPerIp: 30,      // concurrent connections per IP (friends on shared home wifi share one public IP)
  rateLimitPerSec: 25,   // messages / second / connection

  // ─── Gameplay timers (ms) ──────────────────────────────────
  bidTimeoutMs: 30_000,        // time to bid before an auto-bid of 0
  playTimeoutMs: 30_000,       // time to play before an auto-play of a legal card
  reconnectWindowMs: 60_000,   // grace period for a disconnected player to return
  emptyRoomDestroyMs: 120_000, // keep an empty room this long before destroying it
  gameOverTtlMs: 15_000,       // keep a finished room this long before it auto-closes (rematch cancels it)
  countdownMs: 5_000,          // lobby auto-start countdown once the room is full
  disconnectedAutoMoveMs: 500, // auto-move delay for a disconnected player's seat
  trickDisplayMs: 1_500,       // how long a completed trick is shown
  roundEndDelayMs: 3_000,      // pause after round scoring before the next round
};
