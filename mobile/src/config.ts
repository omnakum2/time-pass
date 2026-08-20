// WebSocket endpoint for the Bid Club game server.
//
// Tunable via the EXPO_PUBLIC_WS_URL env var: Expo inlines EXPO_PUBLIC_* at
// build/start time from a .env file (see .env.example). Falls back to the
// production server when unset, so the app works out of the box. Native has no
// window.location to derive the URL from, hence an explicit value.
//
// Local / LAN testing: create mobile/.env.local (gitignored) with e.g.
//   EXPO_PUBLIC_WS_URL=ws://192.168.1.50:3000
export const WS_URL =
  process.env.EXPO_PUBLIC_WS_URL ?? 'wss://prediction-card-game.onrender.com';
