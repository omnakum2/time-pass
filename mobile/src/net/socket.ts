import { ClientMessage, ServerMessage } from 'shared';
import { AppState, AppStateStatus } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { storage } from '../storage';
import { WS_URL } from '../config';
import { RECONNECT_BASE_MS, RECONNECT_MAX_MS, RECONNECT_EXP_CAP } from '../constants';

// Native WebSocket client for the Bid Club game server. Ported from the web
// client's net/socket.ts. Differences on React Native:
//   • The endpoint is a fixed config constant (no window.location to derive from).
//   • The seat/session is read synchronously from storage's in-memory cache
//     (AsyncStorage is async; the cache is hydrated at app boot — see storage.ts).
//   • startAppStateReconnect() reopens the socket when the app returns to the
//     foreground, since the OS suspends the connection while backgrounded.

let ws: WebSocket | null = null;
let reconnectAttempts = 0;
let manualClose = false;
// True while an automatic session-reconnect is in flight. Lets us swallow the
// server's ROOM_NOT_FOUND/INVALID_TOKEN reply (stale session) instead of
// surfacing it as an error toast on a fresh app launch.
let reconnecting = false;

export function sendMsg(msg: ClientMessage): void {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

// Ask the server to restore our seat. Used by the auto-reconnect on connect AND by the
// "Join" screen when the user already holds a seat in the target room (e.g. app backgrounded).
export function reconnectSession(roomId: string, token: string): void {
  reconnecting = true;
  sendMsg({ type: 'reconnect', roomId, token });
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

    // Try to reconnect to an existing session (hydrated into the cache at boot).
    const session = storage.getCachedSession();
    if (session) reconnectSession(session.roomId, session.token);
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

// Reopen the socket when the app returns to the foreground. The OS suspends the
// WebSocket while the app is backgrounded; connect() is a no-op when a socket is
// already live, so calling it on every 'active' transition is safe. Returns an
// unsubscribe function for the caller to run on teardown.
export function startAppStateReconnect(): () => void {
  const handler = (state: AppStateStatus) => {
    if (state === 'active') connect();
  };
  const sub = AppState.addEventListener('change', handler);
  return () => sub.remove();
}

function dispatch(msg: ServerMessage): void {
  const store = useGameStore.getState();
  switch (msg.type) {
    case 'joined':
      reconnecting = false;
      void storage.setSession({ roomId: msg.roomId, token: msg.token, playerId: msg.playerId });
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
      void storage.clearSession();
      store.setRoomClosed(true);
      break;
    case 'quickMessage':
      store.setBubble(msg.senderId, msg.text);
      break;
    case 'error':
      // A failed auto-reconnect just means the stored session is stale (room
      // gone / server restarted). Drop it silently — don't nag the user with a
      // "Room not found" toast on a fresh launch.
      if (reconnecting && (msg.code === 'ROOM_NOT_FOUND' || msg.code === 'INVALID_TOKEN')) {
        reconnecting = false;
        void storage.clearSession();
        store.setReconnectFailed(true); // signal the UI to route to the join prompt / show "expired"
        break;
      }
      store.setError(msg.code, msg.message);
      break;
  }
}
