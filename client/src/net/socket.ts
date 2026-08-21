import { ClientMessage, ServerMessage } from 'shared';
import { useGameStore } from '../store/gameStore';
import { storage } from '../storage';
import { getIdToken, getIdTokenIfSignedIn } from '../auth';
import { WS_DEFAULT_PORT, RECONNECT_BASE_MS, RECONNECT_MAX_MS, RECONNECT_EXP_CAP } from '../constants';

// Environment-specific WS endpoint, from Vite's import.meta.env (see
// .env.example). VITE_WS_URL wins when set; otherwise build
// ws(s)://<page-host>:<VITE_WS_PORT> (protocol matches the page).
const wsProto = window.location.protocol === 'https:' ? 'wss' : 'ws';
const WS_PORT = import.meta.env.VITE_WS_PORT || WS_DEFAULT_PORT;
const WS_URL = import.meta.env.VITE_WS_URL || `${wsProto}://${window.location.hostname}:${WS_PORT}`;

let ws: WebSocket | null = null;
let reconnectAttempts = 0;
let manualClose = false;
// True while an automatic session-reconnect is in flight. Lets us swallow the
// server's ROOM_NOT_FOUND/INVALID_TOKEN reply (stale session) instead of
// surfacing it as an error toast on a fresh page load.
let reconnecting = false;

export function sendMsg(msg: ClientMessage): void {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

// Ask the server to restore our seat. Used by the auto-reconnect on connect AND by the
// "Join" screen when the user already holds a seat in the target room (e.g. tab closed).
// Attach a Google ID token so the reconnected socket re-authenticates (V3 identity);
// anonymous when Firebase isn't configured / the user isn't signed in (non-breaking).
export async function reconnectSession(roomId: string, token: string): Promise<void> {
  reconnecting = true;
  const idToken = await getIdToken();
  sendMsg({ type: 'reconnect', roomId, token, ...(idToken ? { idToken } : {}) });
}

export function connect(): void {
  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) return;
  manualClose = false;

  // Capture this specific socket instance so a stale socket's late callbacks
  // can never null out or reconnect over a newer one (reconnect-race fix).
  const sock = new WebSocket(WS_URL);
  ws = sock;

  sock.onopen = () => {
    if (ws !== sock) return;
    reconnectAttempts = 0;
    useGameStore.getState().setConnected(true);

    // Try to reconnect to existing session
    const session = storage.getSession();
    if (session) void reconnectSession(session.roomId, session.token);
  };

  sock.onmessage = (ev) => {
    if (ws !== sock) return;
    let msg: ServerMessage;
    try { msg = JSON.parse(ev.data as string) as ServerMessage; }
    catch { return; }
    dispatch(msg);
  };

  sock.onclose = () => {
    if (ws !== sock) return; // a newer socket has replaced us — ignore this stale close
    useGameStore.getState().setConnected(false);
    ws = null;
    // Retry indefinitely (until manualClose) with a capped backoff so a
    // cold/slept backend and transient drops self-heal silently.
    if (!manualClose) {
      reconnectAttempts++;
      const delay = Math.min(RECONNECT_BASE_MS * 2 ** Math.min(reconnectAttempts, RECONNECT_EXP_CAP), RECONNECT_MAX_MS);
      setTimeout(() => connect(), delay);
    }
  };

  sock.onerror = () => { if (ws === sock) sock.close(); };
}

export function disconnect(): void {
  manualClose = true;
  ws?.close();
}

// ─── Reward senders (V3: daily login + spin) ─────────────────────────────────
// getRewards refreshes status silently (no sign-in popup — skipped when signed
// out). claimDaily / spin are explicit user actions, so a popup is acceptable.

export async function sendGetRewards(): Promise<void> {
  const t = await getIdTokenIfSignedIn();
  if (t) sendMsg({ type: 'getRewards', idToken: t });
}

export async function sendClaimDaily(): Promise<void> {
  const t = await getIdToken();
  if (t) sendMsg({ type: 'claimDaily', idToken: t });
}

export async function sendSpin(): Promise<void> {
  const t = await getIdToken();
  if (t) sendMsg({ type: 'spin', idToken: t });
}

// ─── Gems + leaderboard senders (V3 Phase 5) ─────────────────────────────────
// convertGems is an explicit user action, so a sign-in popup is acceptable (and
// required — you must be signed in to hold Gems). getLeaderboard is a prestige,
// read-only board anyone can view: attach the token only when already signed in
// (silent, no popup) so the server can mark the requester's own row.

export async function sendConvertGems(gems: number): Promise<void> {
  const t = await getIdToken();
  if (t) sendMsg({ type: 'convertGems', gems, idToken: t });
}

export async function sendGetLeaderboard(): Promise<void> {
  const t = await getIdTokenIfSignedIn();
  sendMsg({ type: 'getLeaderboard', ...(t ? { idToken: t } : {}) });
}

function dispatch(msg: ServerMessage): void {
  const store = useGameStore.getState();
  switch (msg.type) {
    case 'joined':
      reconnecting = false;
      storage.setSession({ roomId: msg.roomId, token: msg.token, playerId: msg.playerId });
      store.setSession(msg.playerId, msg.roomId);
      break;
    case 'state':
      store.setState(msg.state);
      break;
    case 'roundResult':
      store.setRoundResult(msg);
      break;
    case 'gameOver':
      store.setGameOver(msg);
      break;
    case 'roomClosed':
      storage.clearSession();
      store.setRoomClosed(true);
      break;
    case 'account':
      store.setAccount(msg.account);
      break;
    case 'rewardsStatus':
      store.setRewards({
        canClaimDaily: msg.canClaimDaily,
        streak: msg.streak,
        spinsUsedToday: msg.spinsUsedToday,
        nextSpinCost: msg.nextSpinCost,
      });
      break;
    case 'dailyReward': {
      store.setAccount(msg.account);
      const prev = store.rewards;
      store.setRewards({
        canClaimDaily: false,
        streak: msg.streak,
        spinsUsedToday: prev?.spinsUsedToday ?? 0,
        nextSpinCost: prev?.nextSpinCost ?? null,
      });
      if (msg.claimed) store.setRewardToast({ kind: 'daily', coins: msg.reward.coins, gems: msg.reward.gems });
      break;
    }
    case 'spinResult': {
      store.setAccount(msg.account);
      const prev = store.rewards;
      store.setRewards({
        canClaimDaily: prev?.canClaimDaily ?? false,
        streak: prev?.streak ?? 0,
        spinsUsedToday: msg.usedToday,
        nextSpinCost: msg.nextCost,
      });
      store.setRewardToast({ kind: 'spin', coins: msg.prize.coins, gems: msg.prize.gems });
      // Feed the wheel: which segment won + the prize. The Lucky Spin modal reads
      // this to animate the octagon to a stop on the winning wedge.
      store.setLastSpin({ segmentIndex: msg.segmentIndex, coins: msg.prize.coins, gems: msg.prize.gems });
      break;
    }
    case 'leaderboard':
      store.setLeaderboard(msg);
      break;
    case 'quickMessage':
      store.setBubble(msg.senderId, msg.text);
      break;
    case 'error':
      // A failed auto-reconnect just means the stored session is stale (room
      // gone / server restarted). Drop it silently — don't nag the user with a
      // "Room not found" toast on a fresh load.
      if (reconnecting && (msg.code === 'ROOM_NOT_FOUND' || msg.code === 'INVALID_TOKEN')) {
        reconnecting = false;
        storage.clearSession();
        store.setReconnectFailed(true); // signal the UI to route to the join prompt / show "expired"
        break;
      }
      store.setError(msg.code, msg.message);
      break;
  }
}
