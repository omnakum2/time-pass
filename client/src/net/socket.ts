import { ClientMessage, ServerMessage } from 'shared';
import { useSessionStore } from '../store/sessionStore';
import { useBidBaaziStore } from '../store/bidbaaziStore';
import { useThosoStore } from '../store/thosoStore';

// Per-game state-message dispatch: each game's `*State` server message routes to
// its own store. Adding a game = add one entry here (plus its case in dispatch()).
const GAME_STATE_DISPATCH: Record<string, (state: any) => void> = {
  state:      (s) => useBidBaaziStore.getState().setState(s),
  thosoState: (s) => useThosoStore.getState().setThosoState(s),
};
import { storage } from '../storage';
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
    useSessionStore.getState().setConnected(true);

    // Try to reconnect to existing session
    const session = storage.getSession();
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
    useSessionStore.getState().setConnected(false);
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

function dispatch(msg: ServerMessage): void {
  const store = useSessionStore.getState();
  switch (msg.type) {
    case 'joined':
      reconnecting = false;
      storage.setSession({ roomId: msg.roomId, token: msg.token, playerId: msg.playerId });
      store.setSession(msg.playerId, msg.roomId);
      break;
    case 'state':
    case 'thosoState':
      GAME_STATE_DISPATCH[msg.type]?.(msg.state);
      break;
    case 'roundResult':
      useBidBaaziStore.getState().setRoundResult(msg);
      break;
    case 'gameOver':
      useBidBaaziStore.getState().setGameOver(msg);
      break;
    case 'roomClosed':
      storage.clearSession();
      store.setRoomClosed(true);
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
