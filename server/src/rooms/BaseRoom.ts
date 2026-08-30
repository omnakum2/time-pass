import WebSocket from 'ws';
import { Player, ErrorCode, Card, ClientMessage } from 'shared';
import {
  RECONNECT_WINDOW_MS, EMPTY_ROOM_DESTROY_MS, LOBBY_RECONNECT_WINDOW_MS, QUICK_MSG_THROTTLE_MS,
  NPC_AUTO_MOVE_MS, GAME_OVER_TTL_MS, COUNTDOWN_MS,
} from '../constants';
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

  // Shared room-lifecycle timer/turn state — the machinery below (reconnect/disconnect/
  // leaveRoom, the countdown/game-over/turn timers) reads and writes these.
  protected currentTurnSeatIndex = 0;
  protected turnTimer: ReturnType<typeof setTimeout> | null = null;
  protected turnExpiresAt: number | null = null;         // absolute epoch ms the current turn auto-resolves
  protected turnPausedRemainingMs: number | null = null; // frozen turn time while the room is empty (paused)
  protected gameOverTimer: ReturnType<typeof setTimeout> | null = null;
  protected gameOverExpiresAt: number | null = null;
  protected countdownTimer: ReturnType<typeof setTimeout> | null = null;
  protected countdownEndsAt: number | null = null;

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
      this.hostId = next.player.id; // callers broadcast (matches staging — no redundant snapshot here)
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
  abstract handleGameMessage(playerId: string, msg: ClientMessage): ErrorCode | null;

  // Common per-game room surface the server's message router depends on:
  abstract addPlayer(ws: WebSocket, name: string, asHost?: boolean): Seat | null;
  abstract getPhase(): string;
  abstract resendPhaseExtras(ws: WebSocket): void;

  // Per-game hooks the shared room-lifecycle machinery below calls into:
  protected abstract isTurnPhase(): boolean;   // true during a live-turn phase (drives reconnect/disconnect turn-timer resume)
  protected abstract autoAction(): void;       // the game's auto-move when a turn times out
  protected abstract beginGame(): void;        // start the game from a full lobby (countdown expiry)

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

  // ─── Seat helpers (shared) ──────────────────────────────────────────────────

  protected currentTurnPlayerId(): string {
    return this.seats[this.currentTurnSeatIndex]?.player.id ?? '';
  }

  protected nextSeatIndex(from: number): number {
    return (from + 1) % this.seats.length;
  }

  // ─── Connection lifecycle (shared) ──────────────────────────────────────────

  reconnect(ws: WebSocket, token: string): Seat | null {
    const seat = this.getSeatByToken(token);
    if (!seat) return null;
    seat.reconnectTimer = this.clearTimer(seat.reconnectTimer);
    // FIX 9: one active connection per seat — close any older, different socket.
    if (seat.ws && seat.ws !== ws) { try { seat.ws.close(1000, 'replaced'); } catch { /* ignore */ } }
    seat.ws = ws;
    seat.player.status = 'online';
    // If the host left/went offline while we were away, take over so the room isn't left
    // host-less (host-only actions: rematch, room settings). The caller broadcasts.
    const host = this.hostId ? this.getSeat(this.hostId) : undefined;
    if (!host || host.player.status === 'offline') this.hostId = seat.player.id;
    this.cancelEmptyRoomTimer();

    // Resume the turn timer WITHOUT extending the deadline. If the game was paused
    // (everyone had dropped), restore the frozen remaining time first. A refresh can
    // never buy more time — the turn's deadline is fixed for its whole duration.
    if (this.isTurnPhase()) {
      if (this.turnPausedRemainingMs != null) {
        this.turnExpiresAt = Date.now() + this.turnPausedRemainingMs;
        this.turnPausedRemainingMs = null;
      }
      this.armTurnTimer();
    }
    return seat;
  }

  // `immediate` (opts) = an explicit in-game Leave: a real exit, so skip the reconnecting
  // grace and go straight to 'offline'. A tab-close / refresh (the default) keeps the grace.
  disconnect(playerId: string, closingWs?: WebSocket, opts?: { immediate?: boolean }): void {
    const seat = this.getSeat(playerId);
    if (!seat) return;
    // FIX 1: ignore a stale/late close from a socket that's no longer this seat's
    // (e.g. after a fresh reconnect replaced it). Internal callers pass no ws.
    if (closingWs !== undefined && seat.ws !== closingWs) return;

    const immediate = opts?.immediate === true;
    seat.reconnectTimer = this.clearTimer(seat.reconnectTimer);
    seat.ws = null;
    seat.player.status = immediate ? 'offline' : 'reconnecting';

    if (this.getPhase() === 'LOBBY') {
      // FIX 4: don't drop the seat on a refresh; give a short window to reconnect.
      if (!immediate) {
        seat.reconnectTimer = setTimeout(() => {
          seat.reconnectTimer = null;
          if (seat.player.status !== 'online') {
            this.removeSeat(playerId);
            this.broadcastState();
            if (this.isEmpty) this.startEmptyRoomTimer();
          }
        }, LOBBY_RECONNECT_WINDOW_MS);
      }
    } else if (immediate) {
      // Explicit in-game leave — hand off host now (no grace window).
      if (playerId === this.hostId) this.reassignHostToConnected();
    } else {
      // In-game drop: start the reconnect window. When the grace fully expires and the
      // player is still gone, mark them offline and hand off host if needed.
      seat.reconnectTimer = setTimeout(() => {
        seat.reconnectTimer = null;
        if (seat.player.status !== 'online') {
          seat.player.status = 'offline';
          if (playerId === this.hostId) this.reassignHostToConnected();
          this.broadcastState();
        }
      }, RECONNECT_WINDOW_MS);

      // A finished room is destroyed on its short GAME_OVER TTL, which elapses well
      // before the 60s reconnect window — so if the host drops here, hand off now so a
      // remaining player can still start a rematch.
      if (this.getPhase() === 'GAME_OVER' && playerId === this.hostId) {
        this.reassignHostToConnected();
      }
    }

    // Turn timer: if the room just emptied mid-turn, freeze the remaining time so it
    // doesn't tick away while nobody can act (reconnect() restores it). Otherwise, an
    // explicit leave on the leaver's OWN turn resolves fast instead of waiting the full
    // budget — matching how an already-offline seat is auto-moved. A normal drop leaves
    // the turn's fixed deadline untouched.
    if (this.isEmpty && this.turnExpiresAt != null) {
      this.turnPausedRemainingMs = Math.max(0, this.turnExpiresAt - Date.now());
      this.turnExpiresAt = null;
      this.cancelTurnTimer();
    } else if (immediate &&
               this.currentTurnPlayerId() === playerId &&
               this.isTurnPhase()) {
      this.turnExpiresAt = Date.now() + NPC_AUTO_MOVE_MS;
      this.armTurnTimer();
    }

    this.broadcastState();

    // Check if room is empty
    if (this.isEmpty) {
      this.startEmptyRoomTimer();
    }
  }

  leaveRoom(playerId: string): void {
    const seat = this.getSeat(playerId);
    if (!seat) return;

    // In-game leave: an explicit Leave is a real exit — reuse disconnect's teardown but
    // skip the reconnecting grace (immediate: true → straight to 'offline'). Seat/turn/bid
    // indices stay intact (hard removal mid-round would corrupt state); the seat auto-plays
    // to the end and beginTurn fast-forwards its future turns because it's 'offline'.
    if (this.getPhase() !== 'LOBBY' && this.getPhase() !== 'GAME_OVER') {
      this.disconnect(playerId, undefined, { immediate: true });
      return;
    }

    seat.reconnectTimer = this.clearTimer(seat.reconnectTimer);
    this.removeSeat(playerId); // remove the seat entirely

    this.broadcastState();

    if (this.seats.length === 0) {
      this.startEmptyRoomTimer();
    }
  }

  // ─── Lobby countdown (shared) ───────────────────────────────────────────────

  protected maybeStartCountdown(): void {
    if (this.getPhase() !== 'LOBBY') return;
    if (this.seats.length < this.maxPlayers) return; // only when full
    if (this.countdownTimer) clearTimeout(this.countdownTimer);
    this.countdownEndsAt = Date.now() + COUNTDOWN_MS;
    this.countdownTimer = setTimeout(() => {
      this.countdownTimer = null;
      this.countdownEndsAt = null;
      this.beginGame();
    }, COUNTDOWN_MS);
    this.broadcastState();
  }

  protected cancelCountdown(): void {
    this.countdownTimer = this.clearTimer(this.countdownTimer);
    this.countdownEndsAt = null;
  }

  // ─── Turn timer (shared) ────────────────────────────────────────────────────

  // (Re)arm the auto-move timer to the REMAINING time of the current deadline. Never
  // extends it — used on reconnect/resume so a refresh can't reset or lengthen a turn.
  protected armTurnTimer(): void {
    this.cancelTurnTimer();
    if (this.turnExpiresAt == null) return;
    const ms = Math.max(0, this.turnExpiresAt - Date.now());
    this.turnTimer = setTimeout(() => { this.autoAction(); }, ms);
  }

  protected cancelTurnTimer(): void {
    this.turnTimer = this.clearTimer(this.turnTimer);
  }

  // ─── Game-over timer (shared) ───────────────────────────────────────────────

  protected startGameOverTimer(): void {
    this.cancelGameOverTimer();
    this.gameOverExpiresAt = Date.now() + GAME_OVER_TTL_MS;
    this.gameOverTimer = setTimeout(() => {
      this.gameOverTimer = null;
      this.broadcast({ type: 'roomClosed' });
      this.onDestroy?.();
    }, GAME_OVER_TTL_MS);
  }

  protected cancelGameOverTimer(): void {
    this.gameOverTimer = this.clearTimer(this.gameOverTimer);
    this.gameOverExpiresAt = null;
  }
}
