import { v4 as uuidv4 } from 'uuid';
import WebSocket from 'ws';
import {
  RummyCard, RummyGroups, RummyPhase, RummyGameState, DeckMode, ErrorCode, MsgRummyGameOver,
  dealRummy, validateDeclare, recyclePile,
} from 'shared';
import {
  RUMMY_TURN_TIMEOUT_MS, RECONNECT_WINDOW_MS, EMPTY_ROOM_DESTROY_MS,
  GAME_OVER_TTL_MS, COUNTDOWN_MS, DISCONNECTED_AUTO_MOVE_MS, LOBBY_RECONNECT_WINDOW_MS,
} from '../../constants';
import { sendMessage, clampPlayers } from '../../helpers';
import { BaseRoom, Seat } from '../BaseRoom';

const RUMMY_MAX_PLAYERS = 6;

export class RummyRoom extends BaseRoom {
  private phase: RummyPhase = 'LOBBY';

  getPhase(): RummyPhase {
    return this.phase;
  }

  // Round state
  private deckMode: DeckMode = 'single';
  private trumpCard: RummyCard | null = null;
  private drawPile: RummyCard[] = [];
  private discardPile: RummyCard[] = []; // last element = top of pile
  private ranks: Map<string, number | null> = new Map(); // playerId -> declare order (1 = winner)
  private nextRank = 1;
  private currentTurnSeatIndex = 0;
  private startSeatIndex = 0; // rotates each new hand so the same player doesn't always open
  private hasDrawnThisTurn = false;
  private justDrawnFromDiscardId: string | null = null;

  private turnTimer: ReturnType<typeof setTimeout> | null = null;
  private turnExpiresAt: number | null = null;
  private turnPausedRemainingMs: number | null = null;
  private gameOverTimer: ReturnType<typeof setTimeout> | null = null;
  private gameOverExpiresAt: number | null = null;
  private countdownTimer: ReturnType<typeof setTimeout> | null = null;
  private countdownEndsAt: number | null = null;
  private lastGameOver: MsgRummyGameOver | null = null;

  constructor(id: string, maxPlayers = RUMMY_MAX_PLAYERS) {
    super(id, Math.min(RUMMY_MAX_PLAYERS, clampPlayers(maxPlayers)));
  }

  // ─── Seat helpers ─────────────────────────────────────────────────────────

  private currentTurnPlayerId(): string {
    return this.seats[this.currentTurnSeatIndex]?.player.id ?? '';
  }

  private undeclaredSeats(): Seat[] {
    return this.seats.filter(s => this.ranks.get(s.player.id) == null);
  }

  private nextUndeclaredSeatIndex(from: number): number {
    const n = this.seats.length;
    let idx = (from + 1) % n;
    let steps = 0;
    while (this.ranks.get(this.seats[idx].player.id) != null && steps < n) {
      idx = (idx + 1) % n;
      steps++;
    }
    return idx;
  }

  protected override removeSeat(playerId: string): void {
    super.removeSeat(playerId);
    this.ranks.delete(playerId);
    if (this.countdownTimer && this.seats.length < this.maxPlayers) this.cancelCountdown();
  }

  // ─── Join / Create ────────────────────────────────────────────────────────

  addPlayer(ws: WebSocket, name: string, asHost = false): Seat | null {
    if (this.phase !== 'LOBBY') return null;
    if (this.isFull) return null;

    const playerId = uuidv4();
    const token = uuidv4();
    const seat: Seat = {
      player: { id: playerId, name, seatIndex: this.seats.length, status: 'online' },
      token,
      ws,
      hand: [],
      reconnectTimer: null,
    };
    this.seats.push(seat);
    this.ranks.set(playerId, null);
    if (asHost) this.hostId = playerId;
    this.cancelEmptyRoomTimer();
    this.maybeStartCountdown();
    return seat;
  }

  reconnect(ws: WebSocket, token: string): Seat | null {
    const seat = this.getSeatByToken(token);
    if (!seat) return null;
    seat.reconnectTimer = this.clearTimer(seat.reconnectTimer);
    if (seat.ws && seat.ws !== ws) { try { seat.ws.close(1000, 'replaced'); } catch { /* ignore */ } }
    seat.ws = ws;
    seat.player.status = 'online';
    this.cancelEmptyRoomTimer();

    if (this.phase === 'PLAYING') {
      if (this.turnPausedRemainingMs != null) {
        this.turnExpiresAt = Date.now() + this.turnPausedRemainingMs;
        this.turnPausedRemainingMs = null;
      }
      this.armTurnTimer();
    }
    return seat;
  }

  disconnect(playerId: string, closingWs?: WebSocket): void {
    const seat = this.getSeat(playerId);
    if (!seat) return;
    if (closingWs !== undefined && seat.ws !== closingWs) return;

    seat.ws = null;
    seat.player.status = 'reconnecting';

    if (this.phase === 'LOBBY') {
      seat.reconnectTimer = setTimeout(() => {
        seat.reconnectTimer = null;
        if (seat.player.status !== 'online') {
          this.removeSeat(playerId);
          this.broadcastState();
          if (this.isEmpty) this.startEmptyRoomTimer();
        }
      }, LOBBY_RECONNECT_WINDOW_MS);
    } else {
      seat.reconnectTimer = setTimeout(() => {
        seat.reconnectTimer = null;
        if (seat.player.status !== 'online') {
          seat.player.status = 'offline';
          if (playerId === this.hostId) this.reassignHostToConnected();
          this.broadcastState();
        }
      }, RECONNECT_WINDOW_MS);

      if (this.phase === 'GAME_OVER' && playerId === this.hostId) {
        this.reassignHostToConnected();
      }
    }

    if (this.isEmpty && this.turnExpiresAt != null) {
      this.turnPausedRemainingMs = Math.max(0, this.turnExpiresAt - Date.now());
      this.turnExpiresAt = null;
      this.cancelTurnTimer();
    }

    this.broadcastState();
    if (this.isEmpty) this.startEmptyRoomTimer();
  }

  leaveRoom(playerId: string): void {
    const seat = this.getSeat(playerId);
    if (!seat) return;

    if (this.phase !== 'LOBBY' && this.phase !== 'GAME_OVER') {
      this.disconnect(playerId);
      return;
    }

    seat.reconnectTimer = this.clearTimer(seat.reconnectTimer);
    this.removeSeat(playerId);
    this.broadcastState();
    if (this.seats.length === 0) this.startEmptyRoomTimer();
  }

  // ─── Lobby ────────────────────────────────────────────────────────────────

  startGame(requesterId: string): ErrorCode | null {
    if (requesterId !== this.hostId) return 'NOT_HOST';
    if (this.phase !== 'LOBBY') return 'WRONG_PHASE';
    if (this.seats.length < 2) return 'NOT_ENOUGH_PLAYERS';

    this.cancelCountdown();
    this.startRound();
    return null;
  }

  restartGame(requesterId: string): ErrorCode | null {
    if (requesterId !== this.hostId) return 'NOT_HOST';
    if (this.phase !== 'GAME_OVER') return 'WRONG_PHASE';

    this.cancelGameOverTimer();
    this.startRound();
    return null;
  }

  private maybeStartCountdown(): void {
    if (this.phase !== 'LOBBY') return;
    if (this.seats.length < this.maxPlayers) return;
    if (this.countdownTimer) clearTimeout(this.countdownTimer);
    this.countdownEndsAt = Date.now() + COUNTDOWN_MS;
    this.countdownTimer = setTimeout(() => {
      this.countdownTimer = null;
      this.countdownEndsAt = null;
      this.beginGame();
    }, COUNTDOWN_MS);
    this.broadcastState();
  }

  private cancelCountdown(): void {
    this.countdownTimer = this.clearTimer(this.countdownTimer);
    this.countdownEndsAt = null;
  }

  private beginGame(): void {
    if (this.phase !== 'LOBBY') return;
    if (this.seats.length < 2) { this.cancelCountdown(); return; }
    this.startRound();
  }

  // ─── Round lifecycle ──────────────────────────────────────────────────────

  private startRound(): void {
    const { hands, trumpCard, drawPile, deckMode } = dealRummy(this.seats.length);
    this.seats.forEach((seat, i) => { seat.hand = hands[i]; });
    this.trumpCard = trumpCard;
    this.drawPile = drawPile;
    this.discardPile = [];
    this.deckMode = deckMode;
    this.ranks = new Map(this.seats.map(s => [s.player.id, null]));
    this.nextRank = 1;
    this.hasDrawnThisTurn = false;
    this.justDrawnFromDiscardId = null;

    this.currentTurnSeatIndex = this.startSeatIndex % this.seats.length;
    this.startSeatIndex = (this.startSeatIndex + 1) % this.seats.length;

    this.phase = 'PLAYING';
    this.beginTurn();
    this.broadcastState();
  }

  // ─── Playing ──────────────────────────────────────────────────────────────

  drawCard(playerId: string, source: 'pile' | 'discard'): ErrorCode | null {
    if (this.phase !== 'PLAYING') return 'WRONG_PHASE';
    if (this.currentTurnPlayerId() !== playerId) return 'NOT_YOUR_TURN';
    if (this.hasDrawnThisTurn) return 'WRONG_PHASE';
    const seat = this.getSeat(playerId);
    if (!seat) return 'NOT_IN_ROOM';

    let card: RummyCard;
    if (source === 'discard') {
      if (this.discardPile.length === 0) return 'INVALID_DRAW_SOURCE';
      card = this.discardPile.pop()!;
      this.justDrawnFromDiscardId = card.id;
    } else {
      if (this.drawPile.length === 0) {
        const recycled = recyclePile(this.discardPile);
        this.drawPile = recycled.drawPile;
        this.discardPile = recycled.discardPile;
      }
      if (this.drawPile.length === 0) return 'INVALID_DRAW_SOURCE';
      card = this.drawPile.pop()!;
      this.justDrawnFromDiscardId = null;
    }

    (seat.hand as RummyCard[]).push(card);
    this.hasDrawnThisTurn = true;
    this.broadcastState();
    return null;
  }

  discardCard(playerId: string, cardId: string): ErrorCode | null {
    if (this.phase !== 'PLAYING') return 'WRONG_PHASE';
    if (this.currentTurnPlayerId() !== playerId) return 'NOT_YOUR_TURN';
    if (!this.hasDrawnThisTurn) return 'WRONG_PHASE';
    if (cardId === this.justDrawnFromDiscardId) return 'INVALID_DISCARD';
    const seat = this.getSeat(playerId);
    if (!seat) return 'NOT_IN_ROOM';

    const hand = seat.hand as RummyCard[];
    const idx = hand.findIndex(c => c.id === cardId);
    if (idx === -1) return 'CARD_NOT_IN_HAND';

    const [card] = hand.splice(idx, 1);
    this.discardPile.push(card);
    this.endTurn();
    return null;
  }

  declare(playerId: string, cardIdToDiscard: string, groups: RummyGroups): ErrorCode | null {
    if (this.phase !== 'PLAYING') return 'WRONG_PHASE';
    if (this.currentTurnPlayerId() !== playerId) return 'NOT_YOUR_TURN';
    if (!this.hasDrawnThisTurn) return 'WRONG_PHASE';
    if (cardIdToDiscard === this.justDrawnFromDiscardId) return 'INVALID_DISCARD';
    const seat = this.getSeat(playerId);
    if (!seat || !this.trumpCard) return 'NOT_IN_ROOM';

    const hand = seat.hand as RummyCard[];
    const idx = hand.findIndex(c => c.id === cardIdToDiscard);
    if (idx === -1) return 'CARD_NOT_IN_HAND';

    const remaining = hand.filter(c => c.id !== cardIdToDiscard);
    if (!validateDeclare(remaining, groups, this.trumpCard, this.deckMode)) return 'INVALID_DECLARE';

    const [card] = hand.splice(idx, 1);
    this.discardPile.push(card);
    this.ranks.set(playerId, this.nextRank++);
    this.endTurn();
    return null;
  }

  private endTurn(): void {
    this.cancelTurnTimer();
    this.hasDrawnThisTurn = false;
    this.justDrawnFromDiscardId = null;

    const undeclared = this.undeclaredSeats();
    if (undeclared.length <= 1) {
      if (undeclared.length === 1) this.ranks.set(undeclared[0].player.id, this.nextRank++);
      this.finishGame();
      return;
    }

    this.currentTurnSeatIndex = this.nextUndeclaredSeatIndex(this.currentTurnSeatIndex);
    this.beginTurn();
    this.broadcastState();
  }

  private finishGame(): void {
    this.phase = 'GAME_OVER';
    this.turnExpiresAt = null;

    const ranksObj: Record<string, number> = {};
    const playerNames: Record<string, string> = {};
    for (const seat of this.seats) {
      ranksObj[seat.player.id] = this.ranks.get(seat.player.id) ?? this.nextRank;
      playerNames[seat.player.id] = seat.player.name;
    }

    const msg: MsgRummyGameOver = { type: 'rummyGameOver', ranks: ranksObj, playerNames };
    this.lastGameOver = msg;
    this.startGameOverTimer();
    this.broadcast(msg);
    this.broadcastState();
  }

  // ─── Timers ───────────────────────────────────────────────────────────────

  private beginTurn(): void {
    this.cancelTurnTimer();
    this.turnPausedRemainingMs = null;
    if (this.isEmpty) { this.turnExpiresAt = null; return; }
    const currentSeat = this.seats[this.currentTurnSeatIndex];
    const offline = currentSeat?.player.status === 'offline';
    const duration = offline ? DISCONNECTED_AUTO_MOVE_MS : RUMMY_TURN_TIMEOUT_MS;
    this.turnExpiresAt = Date.now() + duration;
    this.armTurnTimer();
  }

  private armTurnTimer(): void {
    this.cancelTurnTimer();
    if (this.turnExpiresAt == null) return;
    const ms = Math.max(0, this.turnExpiresAt - Date.now());
    this.turnTimer = setTimeout(() => this.autoAction(), ms);
  }

  private cancelTurnTimer(): void {
    this.turnTimer = this.clearTimer(this.turnTimer);
  }

  private autoAction(): void {
    const playerId = this.currentTurnPlayerId();
    const seat = this.getSeat(playerId);
    if (!seat) return;
    if (!this.hasDrawnThisTurn) this.drawCard(playerId, 'pile');

    const hand = seat.hand as RummyCard[];
    const candidate = hand.find(c => c.id !== this.justDrawnFromDiscardId);
    if (candidate) this.discardCard(playerId, candidate.id);
  }

  private startGameOverTimer(): void {
    this.cancelGameOverTimer();
    this.gameOverExpiresAt = Date.now() + GAME_OVER_TTL_MS;
    this.gameOverTimer = setTimeout(() => {
      this.gameOverTimer = null;
      this.broadcast({ type: 'roomClosed' });
      this.onDestroy?.();
    }, GAME_OVER_TTL_MS);
  }

  private cancelGameOverTimer(): void {
    this.gameOverTimer = this.clearTimer(this.gameOverTimer);
    this.gameOverExpiresAt = null;
  }

  // ─── State broadcast ──────────────────────────────────────────────────────

  private buildState(forPlayerId: string): RummyGameState {
    const seat = this.getSeat(forPlayerId);
    const handCounts: Record<string, number> = {};
    for (const s of this.seats) {
      if (s.player.id !== forPlayerId) handCounts[s.player.id] = s.hand.length;
    }

    const isMyTurn = this.currentTurnPlayerId() === forPlayerId;
    const turnActive = this.phase === 'PLAYING';

    return {
      phase: this.phase,
      roomId: this.id,
      players: this.seats.map(s => s.player),
      hostId: this.hostId ?? '',
      maxPlayers: this.maxPlayers,
      deckMode: this.deckMode,
      trumpCard: this.trumpCard,
      yourHand: (seat?.hand as RummyCard[]) ?? [],
      handCounts,
      drawPileCount: this.drawPile.length,
      discardTop: this.discardPile.length ? this.discardPile[this.discardPile.length - 1] : null,
      currentTurn: this.currentTurnPlayerId() || null,
      hasDrawnThisTurn: this.hasDrawnThisTurn,
      justDrawnCardId: isMyTurn ? this.justDrawnFromDiscardId : null,
      ranks: Object.fromEntries(this.ranks),
      countdownMs: this.countdownEndsAt ? Math.max(0, this.countdownEndsAt - Date.now()) : null,
      turnTimeoutMs: RUMMY_TURN_TIMEOUT_MS,
      turnExpiresAt: turnActive ? this.turnExpiresAt : null,
      turnRemainingMs: turnActive
        ? (this.turnExpiresAt != null ? Math.max(0, this.turnExpiresAt - Date.now()) : this.turnPausedRemainingMs)
        : null,
      roomExpiresInMs: this.gameOverExpiresAt ? Math.max(0, this.gameOverExpiresAt - Date.now()) : null,
    };
  }

  broadcastState(): void {
    this.forEachOpenSeat(seat => {
      const state = this.buildState(seat.player.id);
      sendMessage(seat.ws!, { type: 'rummyState', state });
    });
  }

  sendState(ws: WebSocket, playerId: string): void {
    const state = this.buildState(playerId);
    sendMessage(ws, { type: 'rummyState', state });
  }

  resendPhaseExtras(ws: WebSocket): void {
    if (this.phase === 'GAME_OVER' && this.lastGameOver) sendMessage(ws, this.lastGameOver);
  }
}
