import { ClientMessage, ServerMessage } from 'shared';
import { useGameStore } from '../store/gameStore';
import { storage } from '../storage';

const WS_URL = import.meta.env.VITE_WS_URL ?? `ws://${window.location.hostname}:3000`;

let ws: WebSocket | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT = 5;
let manualClose = false;

export function getSocket(): WebSocket | null { return ws; }

export function sendMsg(msg: ClientMessage): void {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

export function connect(): void {
  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) return;
  manualClose = false;

  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    reconnectAttempts = 0;
    useGameStore.getState().setConnected(true);

    // Try to reconnect to existing session
    const session = storage.getSession();
    if (session) {
      sendMsg({ type: 'reconnect', roomId: session.roomId, token: session.token });
    }
  };

  ws.onmessage = (ev) => {
    let msg: ServerMessage;
    try { msg = JSON.parse(ev.data as string) as ServerMessage; }
    catch { return; }
    dispatch(msg);
  };

  ws.onclose = () => {
    useGameStore.getState().setConnected(false);
    ws = null;
    if (!manualClose && reconnectAttempts < MAX_RECONNECT) {
      reconnectAttempts++;
      const delay = Math.min(1000 * 2 ** reconnectAttempts, 15_000);
      setTimeout(() => connect(), delay);
    }
  };

  ws.onerror = () => { ws?.close(); };
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
      storage.setSnapshot(msg.state);
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
