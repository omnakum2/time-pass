// LIVE-ONLY WebSocket endpoint for the game server, used for BOTH dev and prod
// (no LAN dev mode; the V2 server is unchanged). Native has no window.location
// to derive it from, so it is an explicit constant.
//
// ⚠️ PLACEHOLDER — needs the real production WS server URL.
// `bidclub.onrender.com` is the STATIC FRONTEND (it returns the SPA HTML and does
// NOT accept a WebSocket upgrade). The web app connects via its build-time
// `VITE_WS_URL`, which points at a SEPARATE Render service (not committed to the
// repo). Replace the value below with that production WS URL before on-device
// testing, or the app will fail to connect and retry forever.
export const WS_URL = 'wss://bidclub.onrender.com';
