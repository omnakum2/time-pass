import { ClientMessage, ServerMessage } from 'shared';
import { useGameStore } from '../store/gameStore';
import { storage } from '../storage';

const wsProto = window.location.protocol === 'https:' ? 'wss' : 'ws';
const WS_URL = import.meta.env.VITE_WS_URL ?? `${wsProto}://${window.location.hostname}:3000`;

let ws: WebSocket | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT = 5;
let manualClose = false;

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
    if (!manualClose && reconnectAttempts < MAX_RECONNECT) {
      reconnectAttempts++;
      const delay = Math.min(1000 * 2 ** reconnectAttempts, 15_000);
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
    case 'error':
      store.setError(msg.code, msg.message);
      break;
  }
}
