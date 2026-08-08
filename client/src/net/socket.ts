import { ClientMessage, ServerMessage } from 'shared';
import { useGameStore } from '../store/gameStore';
import { storage } from '../storage';

// Environment-specific WS endpoint, from Vite's import.meta.env (see
// .env.example). VITE_WS_URL wins when set; otherwise build
// ws(s)://<page-host>:<VITE_WS_PORT> (protocol matches the page).
const wsProto = window.location.protocol === 'https:' ? 'wss' : 'ws';
const WS_PORT = import.meta.env.VITE_WS_PORT || '3000';
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
    if (session) {
      reconnecting = true;
      sendMsg({ type: 'reconnect', roomId: session.roomId, token: session.token });
    }
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
      const delay = Math.min(1000 * 2 ** Math.min(reconnectAttempts, 4), 10_000);
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
        break;
      }
      store.setError(msg.code, msg.message);
      break;
  }
}
