import { v4 as uuidv4 } from 'uuid';
import WebSocket from 'ws';
import {
  Card, GamePhase, GameState, Player, RoundScore,
  Suit, TrickCard, ServerMessage, MsgRoundResult
} from 'shared';
import {
  deal, pickTrump, firstBidderSeat,
  legalMoves, trickWinner, scoreRound
} from 'shared';

const ROUNDS = [7, 6, 5, 4, 3, 2, 1];
const BID_TIMEOUT_MS = 30_000;
const PLAY_TIMEOUT_MS = 30_000;
const RECONNECT_WINDOW_MS = 60_000;
const EMPTY_ROOM_DESTROY_MS = 120_000;
const GAMEOVER_TTL_MS = 300_000;
const COUNTDOWN_MS = 5000;

export interface Seat {
  player: Player;
  token: string;
  ws: WebSocket | null;
  hand: Card[];
  reconnectTimer: ReturnType<typeof setTimeout> | null;
}

export class Room {
  readonly id: string;
  readonly maxPlayers: number = 7;
  private seats: Seat[] = [];
  private hostId: string | null = null;
  private phase: GamePhase = 'LOBBY';

  // Round state
  private roundIndex = 0; // index into ROUNDS array
  private currentRound: number | null = null;
  private trump: Suit | null = null;
  private previousTrump: Suit | null | undefined = undefined;
  private bids: Map<string, number | null> = new Map();
  private tricksWon: Map<string, number> = new Map();
  private currentTrick: TrickCard[] = [];
  private leadSuit: Suit | null = null;
  private trickLeaderSeatIndex = 0;
  private currentTurnSeatIndex = 0;
  private bidderSeatIndex = 0; // first bidder seat for this round
  private scoreboard: Map<string, RoundScore[]> = new Map();

  private turnTimer: ReturnType<typeof setTimeout> | null = null;
  private emptyRoomTimer: ReturnType<typeof setTimeout> | null = null;
  private gameOverTimer: ReturnType<typeof setTimeout> | null = null;
  private countdownTimer: ReturnType<typeof setTimeout> | null = null;
  private countdownEndsAt: number | null = null;

  // Called when the room should be destroyed
  onDestroy: (() => void) | null = null;

  constructor(id: string, maxPlayers = 7) {
    this.id = id;
    this.maxPlayers = Math.min(7, Math.max(2, maxPlayers));
  }

  // ─── Seat helpers ─────────────────────────────────────────────────────────

  private getSeat(playerId: string): Seat | undefined {
    return this.seats.find(s => s.player.id === playerId);
  }

  private getSeatByToken(token: string): Seat | undefined {
    return this.seats.find(s => s.token === token);
  }

  private currentTurnPlayerId(): string {
    return this.seats[this.currentTurnSeatIndex]?.player.id ?? '';
  }

  private nextSeatIndex(from: number): number {
    return (from + 1) % this.seats.length;
  }

  get playerCount(): number { return this.seats.length; }
  get isFull(): boolean { return this.seats.length >= this.maxPlayers; }
  get isEmpty(): boolean { return this.seats.every(s => s.ws === null); }

  // ─── Join / Create ────────────────────────────────────────────────────────

  addPlayer(ws: WebSocket, name: string, asHost = false): Seat | null {
    if (this.phase !== 'LOBBY') return null;
    if (this.isFull) return null;

    const playerId = uuidv4();
    const token = uuidv4();
    const seat: Seat = {
      player: {
        id: playerId,
        name,
        seatIndex: this.seats.length,
        connected: true,
      },
      token,
      ws,
      hand: [],
      reconnectTimer: null,
    };
    this.seats.push(seat);
    this.scoreboard.set(playerId, []);
    if (asHost) this.hostId = playerId;
    this.cancelEmptyRoomTimer();
    this.maybeStartCountdown();
    return seat;
  }

  reconnect(ws: WebSocket, token: string): Seat | null {
    const seat = this.getSeatByToken(token);
    if (!seat) return null;
    if (seat.reconnectTimer) {
      clearTimeout(seat.reconnectTimer);
      seat.reconnectTimer = null;
    }
    seat.ws = ws;
    seat.player.connected = true;
    this.cancelEmptyRoomTimer();
    return seat;
  }

  disconnect(playerId: string): void {
    const seat = this.getSeat(playerId);
    if (!seat) return;

    seat.ws = null;
    seat.player.connected = false;

    if (this.phase === 'LOBBY') {
      // Remove from lobby entirely
      this.seats = this.seats.filter(s => s.player.id !== playerId);
      this.seats.forEach((s, i) => { s.player.seatIndex = i; });
      this.scoreboard.delete(playerId);

      if (playerId === this.hostId && this.seats.length > 0) {
        // Promote next player to host
        this.hostId = this.seats[0].player.id;
      }

      if (this.countdownTimer && this.seats.length < this.maxPlayers) { this.cancelCountdown(); }
    } else {
      // In-game: start reconnect window
      seat.reconnectTimer = setTimeout(() => {
        seat.reconnectTimer = null;
        // Seat stays but keeps auto-playing via turn timer
      }, RECONNECT_WINDOW_MS);

      // If host left during game → end immediately
      if (playerId === this.hostId) {
        this.endGameImmediately();
        return;
      }

      // If it's this (now-disconnected) player's turn, don't wait the full timer —
      // restart it so their move auto-resolves promptly.
      if ((this.phase === 'BIDDING' || this.phase === 'PLAYING') && this.currentTurnPlayerId() === playerId) {
        this.startTurnTimer();
      }
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

    if (seat.reconnectTimer) {
      clearTimeout(seat.reconnectTimer);
      seat.reconnectTimer = null;
    }

    // Remove the seat entirely
    this.seats = this.seats.filter(s => s.player.id !== playerId);
    this.seats.forEach((s, i) => { s.player.seatIndex = i; });
    this.scoreboard.delete(playerId);

    if (playerId === this.hostId && this.seats.length > 0) {
      // Promote next player to host
      this.hostId = this.seats[0].player.id;
    }

    if (this.countdownTimer && this.seats.length < this.maxPlayers) { this.cancelCountdown(); }

    this.broadcastState();

    if (this.seats.length === 0) {
      this.startEmptyRoomTimer();
    }
  }

  // ─── Lobby ────────────────────────────────────────────────────────────────

  startGame(requesterId: string): string | null {
    if (requesterId !== this.hostId) return 'NOT_HOST';
    if (this.phase !== 'LOBBY') return 'WRONG_PHASE';
    if (this.seats.length < 2) return 'NOT_ENOUGH_PLAYERS';

    this.previousTrump = undefined;
    this.roundIndex = 0;
    this.startRound();
    return null;
  }

  restartGame(requesterId: string): string | null {
    if (requesterId !== this.hostId) return 'NOT_HOST';
    if (this.phase !== 'GAME_OVER') return 'WRONG_PHASE';

    // A rematch cancels the pending game-over cleanup
    this.cancelGameOverTimer();

    // reset per-match state
    this.previousTrump = undefined;
    this.roundIndex = 0;
    this.scoreboard = new Map(this.seats.map(s => [s.player.id, []]));
    this.bids = new Map();
    this.tricksWon = new Map();
    this.currentTrick = [];
    this.leadSuit = null;
    this.startRound();
    return null;
  }

  private maybeStartCountdown(): void {
    if (this.phase !== 'LOBBY') return;
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

  private cancelCountdown(): void {
    if (this.countdownTimer) { clearTimeout(this.countdownTimer); this.countdownTimer = null; }
    this.countdownEndsAt = null;
  }

  private beginGame(): void {
    if (this.phase !== 'LOBBY') return;
    if (this.seats.length < 2) { this.cancelCountdown(); return; }
    this.previousTrump = undefined;
    this.roundIndex = 0;
    this.startRound();
  }

  // ─── Round lifecycle ──────────────────────────────────────────────────────

  private startRound(): void {
    this.phase = 'DEALING';
    this.currentRound = ROUNDS[this.roundIndex];
    this.trump = pickTrump(this.previousTrump);
    this.previousTrump = this.trump;
    this.bids = new Map(this.seats.map(s => [s.player.id, null]));
    this.tricksWon = new Map(this.seats.map(s => [s.player.id, 0]));
    this.currentTrick = [];
    this.leadSuit = null;

    const { hands } = deal(this.currentRound, this.seats.length);
    this.seats.forEach((seat, i) => { seat.hand = hands[i]; });

    const firstSeat = firstBidderSeat(this.currentRound, this.seats.length);
    this.bidderSeatIndex = firstSeat;
    this.trickLeaderSeatIndex = firstSeat;
    this.currentTurnSeatIndex = firstSeat;

    this.phase = 'BIDDING';
    this.broadcastState();
    this.startTurnTimer();
  }

  // ─── Bidding ──────────────────────────────────────────────────────────────

  placeBid(playerId: string, bid: number): string | null {
    if (this.phase !== 'BIDDING') return 'WRONG_PHASE';
    if (this.currentTurnPlayerId() !== playerId) return 'NOT_YOUR_TURN';
    if (!Number.isInteger(bid) || bid < 0 || bid > (this.currentRound ?? 0)) {
      return 'INVALID_BID';
    }

    this.bids.set(playerId, bid);
    this.advanceBidder();
    return null;
  }

  private advanceBidder(): void {
    this.clearTurnTimer();

    // Find next player who hasn't bid
    let next = this.nextSeatIndex(this.currentTurnSeatIndex);
    let steps = 0;
    while (this.bids.get(this.seats[next].player.id) !== null && steps < this.seats.length) {
      next = this.nextSeatIndex(next);
      steps++;
    }

    // Check if all bids placed
    const allBid = [...this.bids.values()].every(b => b !== null);
    if (allBid) {
      this.currentTurnSeatIndex = this.trickLeaderSeatIndex; // first bidder leads first trick
      this.phase = 'PLAYING';
      this.broadcastState();
      this.startTurnTimer();
    } else {
      this.currentTurnSeatIndex = next;
      this.broadcastState();
      this.startTurnTimer();
    }
  }

  // ─── Playing ──────────────────────────────────────────────────────────────

  playCard(playerId: string, cardId: string): string | null {
    if (this.phase !== 'PLAYING') return 'WRONG_PHASE';
    if (this.currentTurnPlayerId() !== playerId) return 'NOT_YOUR_TURN';

    const seat = this.getSeat(playerId);
    if (!seat) return 'NOT_IN_ROOM';

    const cardIndex = seat.hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return 'CARD_NOT_IN_HAND';

    const card = seat.hand[cardIndex];
    const legal = legalMoves(seat.hand, this.leadSuit);
    if (!legal.find(c => c.id === cardId)) return 'ILLEGAL_CARD';

    // Play the card
    seat.hand.splice(cardIndex, 1);
    if (this.currentTrick.length === 0) {
      this.leadSuit = card.suit;
    }
    this.currentTrick.push({ playerId, card });

    this.clearTurnTimer();

    if (this.currentTrick.length === this.seats.length) {
      // Trick complete
      this.resolveTrick();
    } else {
      this.currentTurnSeatIndex = this.nextSeatIndex(this.currentTurnSeatIndex);
      this.broadcastState();
      this.startTurnTimer();
    }

    return null;
  }

  private resolveTrick(): void {
    const winner = trickWinner(this.currentTrick, this.leadSuit!, this.trump);
    const winnerSeat = this.seats.find(s => s.player.id === winner.playerId)!;
    this.tricksWon.set(winner.playerId, (this.tricksWon.get(winner.playerId) ?? 0) + 1);

    const prevTrick = [...this.currentTrick];
    this.currentTrick = [];
    this.leadSuit = null;
    this.trickLeaderSeatIndex = winnerSeat.player.seatIndex;
    this.currentTurnSeatIndex = this.trickLeaderSeatIndex;

    // Broadcast the completed trick state briefly, then continue
    this.broadcastState(prevTrick);

    // Check if round is over (no cards left)
    if (this.seats[0].hand.length === 0) {
      setTimeout(() => this.endRound(), 1500);
    } else {
      setTimeout(() => {
        this.broadcastState();
        this.startTurnTimer();
      }, 1500);
    }
  }

  private endRound(): void {
    this.phase = 'ROUND_SCORING';
    const roundNum = this.currentRound!;

    // Compute deltas
    const perPlayer: MsgRoundResult['perPlayer'] = [];
    for (const seat of this.seats) {
      const pid = seat.player.id;
      const bid = this.bids.get(pid) ?? 0;
      const won = this.tricksWon.get(pid) ?? 0;
      const delta = scoreRound(bid, won);
      const rows = this.scoreboard.get(pid) ?? [];
      const prevTotal = rows.length > 0 ? rows[rows.length - 1].total : 0;
      const total = prevTotal + delta;
      rows.push({ round: roundNum, bid, won, delta, total });
      this.scoreboard.set(pid, rows);
      perPlayer.push({ playerId: pid, name: seat.player.name, bid, won, delta, total });
    }

    // Broadcast round result
    const msg: MsgRoundResult = { type: 'roundResult', round: roundNum, perPlayer };
    this.broadcast(msg);
    this.broadcastState();

    // Advance to next round or end game
    setTimeout(() => {
      this.roundIndex++;
      if (this.roundIndex < ROUNDS.length) {
        this.startRound();
      } else {
        this.endGame();
      }
    }, 3000);
  }

  private endGame(): void {
    this.phase = 'GAME_OVER';

    const finalScores: Record<string, number> = {};
    const playerNames: Record<string, string> = {};
    let maxScore = -Infinity;

    for (const seat of this.seats) {
      const rows = this.scoreboard.get(seat.player.id) ?? [];
      const total = rows.length > 0 ? rows[rows.length - 1].total : 0;
      finalScores[seat.player.id] = total;
      playerNames[seat.player.id] = seat.player.name;
      if (total > maxScore) maxScore = total;
    }

    const winners = Object.entries(finalScores)
      .filter(([, s]) => s === maxScore)
      .map(([id]) => id);

    this.broadcast({ type: 'gameOver', winners, finalScores, playerNames });
    this.broadcastState();

    // TTL-destroy finished rooms unless a rematch cancels it
    this.startGameOverTimer();
  }

  private endGameImmediately(): void {
    this.clearTurnTimer();
    this.phase = 'GAME_OVER';

    const finalScores: Record<string, number> = {};
    const playerNames: Record<string, string> = {};

    for (const seat of this.seats) {
      const rows = this.scoreboard.get(seat.player.id) ?? [];
      const total = rows.length > 0 ? rows[rows.length - 1].total : 0;
      finalScores[seat.player.id] = total;
      playerNames[seat.player.id] = seat.player.name;
    }

    // No winners when host leaves (per spec)
    this.broadcast({ type: 'gameOver', winners: [], finalScores, playerNames });
    this.broadcastState();
  }

  // ─── Timers ───────────────────────────────────────────────────────────────

  private startTurnTimer(): void {
    this.clearTurnTimer();
    const currentSeat = this.seats[this.currentTurnSeatIndex];
    const disconnected = !!currentSeat && !currentSeat.player.connected;
    // A disconnected player shouldn't make everyone wait the full turn timer —
    // auto-move after a short beat (enough for others to see it) instead of 30s.
    const timeoutMs = disconnected
      ? 500
      : (this.phase === 'BIDDING' ? BID_TIMEOUT_MS : PLAY_TIMEOUT_MS);
    this.turnTimer = setTimeout(() => {
      this.autoAction();
    }, timeoutMs);
  }

  private clearTurnTimer(): void {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }
  }

  private autoAction(): void {
    const playerId = this.currentTurnPlayerId();
    if (this.phase === 'BIDDING') {
      this.placeBid(playerId, 0);
    } else if (this.phase === 'PLAYING') {
      const seat = this.getSeat(playerId);
      if (seat) {
        const legal = legalMoves(seat.hand, this.leadSuit);
        if (legal.length > 0) {
          this.playCard(playerId, legal[0].id);
        }
      }
    }
  }

  private startEmptyRoomTimer(): void {
    this.cancelEmptyRoomTimer();
    this.emptyRoomTimer = setTimeout(() => {
      this.onDestroy?.();
    }, EMPTY_ROOM_DESTROY_MS);
  }

  private cancelEmptyRoomTimer(): void {
    if (this.emptyRoomTimer) {
      clearTimeout(this.emptyRoomTimer);
      this.emptyRoomTimer = null;
    }
  }

  private startGameOverTimer(): void {
    this.cancelGameOverTimer();
    this.gameOverTimer = setTimeout(() => {
      this.onDestroy?.();
    }, GAMEOVER_TTL_MS);
  }

  private cancelGameOverTimer(): void {
    if (this.gameOverTimer) {
      clearTimeout(this.gameOverTimer);
      this.gameOverTimer = null;
    }
  }

  // ─── State broadcast ──────────────────────────────────────────────────────

  private buildState(forPlayerId: string, lastTrick?: TrickCard[]): GameState {
    const seat = this.getSeat(forPlayerId);
    const handCounts: Record<string, number> = {};
    for (const s of this.seats) {
      if (s.player.id !== forPlayerId) {
        handCounts[s.player.id] = s.hand.length;
      }
    }

    const bidsObj: Record<string, number | null> = {};
    for (const [pid, bid] of this.bids) {
      bidsObj[pid] = bid;
    }

    const tricksWonObj: Record<string, number> = {};
    for (const [pid, won] of this.tricksWon) {
      tricksWonObj[pid] = won;
    }

    const scoreboardObj: Record<string, RoundScore[]> = {};
    for (const [pid, rows] of this.scoreboard) {
      scoreboardObj[pid] = rows;
    }

    // Use last trick briefly so clients can show the completed trick
    const trickToShow = lastTrick ?? this.currentTrick;

    return {
      phase: this.phase,
      roomId: this.id,
      players: this.seats.map(s => s.player),
      hostId: this.hostId ?? '',
      maxPlayers: this.maxPlayers,
      round: this.currentRound,
      trump: this.trump,
      yourHand: seat?.hand ?? [],
      handCounts,
      bids: bidsObj,
      currentTurn: this.currentTurnPlayerId() || null,
      currentTrick: trickToShow,
      trickLeader: this.seats[this.trickLeaderSeatIndex]?.player.id ?? null,
      scoreboard: scoreboardObj,
      firstBidder: this.seats[this.bidderSeatIndex]?.player.id ?? null,
      tricksWon: tricksWonObj,
      countdownMs: this.countdownEndsAt ? Math.max(0, this.countdownEndsAt - Date.now()) : null,
    };
  }

  broadcastState(lastTrick?: TrickCard[]): void {
    for (const seat of this.seats) {
      if (seat.ws?.readyState === WebSocket.OPEN) {
        const state = this.buildState(seat.player.id, lastTrick);
        this.send(seat.ws, { type: 'state', state });
      }
    }
  }

  sendState(ws: WebSocket, playerId: string): void {
    const state = this.buildState(playerId);
    this.send(ws, { type: 'state', state });
  }

  private broadcast(msg: ServerMessage): void {
    for (const seat of this.seats) {
      if (seat.ws?.readyState === WebSocket.OPEN) {
        this.send(seat.ws, msg);
      }
    }
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      // ignore
    }
  }

  getPhase(): GamePhase { return this.phase; }
}
