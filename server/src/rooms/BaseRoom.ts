import { v4 as uuidv4 } from 'uuid';
import WebSocket from 'ws';
import { Player, ErrorCode, Card } from 'shared';
import { RECONNECT_WINDOW_MS, EMPTY_ROOM_DESTROY_MS, LOBBY_RECONNECT_WINDOW_MS, QUICK_MSG_THROTTLE_MS } from '../constants';
import { sendMessage, clampPlayers } from '../helpers';
import { QUICK_MESSAGES } from 'shared';

export interface Seat {
  player: Player;
  token: string;
  ws: WebSocket | null;
  hand: Card[];
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  lastQuickMsgAt?: number;
}

export abstract class BaseRoom {
  readonly id: string;
  maxPlayers: number; // mutable: a game (e.g. BidClub host settings) can change capacity in the lobby
  protected seats: Seat[] = [];
  protected hostId: string | null = null;
  protected emptyRoomTimer: ReturnType<typeof setTimeout> | null = null;

  onDestroy: (() => void) | null = null;

  constructor(id: string, maxPlayers = 7) {
    this.id = id;
    this.maxPlayers = clampPlayers(maxPlayers);
  }

  protected getSeat(playerId: string): Seat | undefined {
    return this.seats.find(s => s.player.id === playerId);
  }

  protected getSeatByToken(token: string): Seat | undefined {
    return this.seats.find(s => s.token === token);
  }

  get playerCount(): number { return this.seats.length; }
  get isFull(): boolean { return this.seats.length >= this.maxPlayers; }
  get isEmpty(): boolean { return this.seats.every(s => s.ws === null); }

  protected clearTimer(timer: ReturnType<typeof setTimeout> | null): null {
    if (timer) clearTimeout(timer);
    return null;
  }

  protected removeSeat(playerId: string): void {
    this.seats = this.seats.filter(s => s.player.id !== playerId);
    this.seats.forEach((s, i) => { s.player.seatIndex = i; });
    if (playerId === this.hostId && this.seats.length > 0) {
      this.hostId = this.seats[0].player.id;
    }
  }

  protected reassignHostToConnected(): void {
    const next = this.seats.find(s => s.player.status === 'online')
              ?? this.seats.find(s => s.player.status === 'reconnecting');
    if (next && next.player.id !== this.hostId) {
      this.hostId = next.player.id;
      this.broadcastState();
    }
  }

  protected forEachOpenSeat(cb: (seat: Seat) => void): void {
    for (const seat of this.seats) {
      if (seat.ws?.readyState === WebSocket.OPEN) {
        cb(seat);
      }
    }
  }

  broadcast(msg: any): void {
    this.forEachOpenSeat(seat => {
      sendMessage(seat.ws!, msg);
    });
  }

  abstract broadcastState(lastTrick?: any): void;
  abstract sendState(ws: WebSocket, playerId: string): void;

  quickMessage(playerId: string, msgId: string): void {
    const seat = this.getSeat(playerId);
    const item = QUICK_MESSAGES.find(q => q.id === msgId);
    if (!seat || !item) return;
    const now = Date.now();
    if (seat.lastQuickMsgAt && now - seat.lastQuickMsgAt < QUICK_MSG_THROTTLE_MS) return;
    seat.lastQuickMsgAt = now;
    this.broadcast({ type: 'quickMessage', senderId: playerId, text: item.text });
  }

  startEmptyRoomTimer(): void {
    this.cancelEmptyRoomTimer();
    this.emptyRoomTimer = setTimeout(() => {
      this.onDestroy?.();
    }, EMPTY_ROOM_DESTROY_MS);
  }

  cancelEmptyRoomTimer(): void {
    this.emptyRoomTimer = this.clearTimer(this.emptyRoomTimer);
  }
}
