import { v4 as uuidv4 } from 'uuid';
import WebSocket from 'ws';
import {
  Card, GameMode, GamePhase, GameState, Player, RoundScore,
  Suit, TrumpKind, TrumpConfig, TrickCard, ServerMessage, MsgRoundResult, MsgGameOver, ErrorCode, QUICK_MESSAGES, Announcement,
  roundsForMode, deal, pickTrump, firstBidderSeat,
  legalMoves, trickWinner, scoreRound, roundMultiplier, latestTotal, isHandHiddenForBid, announcementFor, isSummitRound, isLastStandRound, ROUNDS, SUITS, RANK_ORDER
} from 'shared';
import {
  BID_TIMEOUT_MS, PLAY_TIMEOUT_MS, RECONNECT_WINDOW_MS, EMPTY_ROOM_DESTROY_MS,
  GAME_OVER_TTL_MS, COUNTDOWN_MS, DISCONNECTED_AUTO_MOVE_MS, TRICK_DISPLAY_MS, ROUND_END_DELAY_MS,
  LOBBY_RECONNECT_WINDOW_MS, QUICK_MSG_THROTTLE_MS, ANNOUNCE_MS, PUSH_TIMEOUT_MS,
} from './constants';
import { sendMessage, clampPlayers } from './helpers';

export interface Seat {
  player: Player;
  token: string;
  ws: WebSocket | null;
  hand: Card[];
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  lastQuickMsgAt?: number; // rate-limit quick chat messages
}

export class Room {
  readonly id: string;
  readonly maxPlayers: number;
  private seats: Seat[] = [];
  private hostId: string | null = null;
  private phase: GamePhase = 'LOBBY';

  // Round state
  private mode: GameMode = 'classic';
  private rounds: number[] = ROUNDS;
  private roundIndex = 0; // index into ROUNDS array
  private currentRound: number | null = null;
  private trump: Suit | null = null;
  private trumpConfig: TrumpConfig | null = null;
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
  private turnExpiresAt: number | null = null;         // absolute epoch ms the current turn auto-resolves
  private turnPausedRemainingMs: number | null = null; // frozen turn time while the room is empty (paused)
  private emptyRoomTimer: ReturnType<typeof setTimeout> | null = null;
  private gameOverTimer: ReturnType<typeof setTimeout> | null = null;
  private gameOverExpiresAt: number | null = null;
  private countdownTimer: ReturnType<typeof setTimeout> | null = null;
  private countdownEndsAt: number | null = null;
  private lastGameOver: MsgGameOver | null = null;       // re-sent if a player reconnects during GAME_OVER
  private lastRoundResult: MsgRoundResult | null = null;  // re-sent if a player reconnects during ROUND_SCORING

  private announcement: Announcement | null = null;      // banner shown during the DEALING window
  private pushed: Set<string> = new Set();               // Blind Bid: players who pushed this round (×3)
  private pushDecided: Set<string> = new Set();          // Blind Bid: players who have locked/pushed this round
  private pushTimer: ReturnType<typeof setTimeout> | null = null;

  // Called when the room should be destroyed
  onDestroy: (() => void) | null = null;

  constructor(id: string, maxPlayers = 7, mode: GameMode = 'classic') {
    this.id = id;
    this.maxPlayers = clampPlayers(maxPlayers);
    this.mode = mode;
    this.rounds = roundsForMode(mode);
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

  // Remove a seat and reindex; promote a new host if the leaver was host, and
  // cancel a pending lobby countdown if the room is no longer full.
  private removeSeat(playerId: string): void {
    this.seats = this.seats.filter(s => s.player.id !== playerId);
    this.seats.forEach((s, i) => { s.player.seatIndex = i; });
    this.scoreboard.delete(playerId);
    if (playerId === this.hostId && this.seats.length > 0) {
      this.hostId = this.seats[0].player.id; // promote next player to host
    }
    if (this.countdownTimer && this.seats.length < this.maxPlayers) this.cancelCountdown();
  }

  // Hand the host role to the first still-connected player (used when the host's
  // in-game reconnect window fully expires).
  private reassignHostToConnected(): void {
    const next = this.seats.find(s => s.player.status === 'online');
    if (next && next.player.id !== this.hostId) {
      this.hostId = next.player.id;
      this.broadcastState();
    }
  }

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
        status: 'online',
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
    seat.reconnectTimer = this.clearTimer(seat.reconnectTimer);
    // FIX 9: one active connection per seat — close any older, different socket.
    if (seat.ws && seat.ws !== ws) { try { seat.ws.close(1000, 'replaced'); } catch { /* ignore */ } }
    seat.ws = ws;
    seat.player.status = 'online';
    this.cancelEmptyRoomTimer();

    // Resume the turn timer WITHOUT extending the deadline. If the game was paused
    // (everyone had dropped), restore the frozen remaining time first. A refresh can
    // never buy more time — the turn's deadline is fixed for its whole duration.
    if (this.phase === 'BIDDING' || this.phase === 'PLAYING' || this.phase === 'TRUMP_SELECT') {
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
    // FIX 1: ignore a stale/late close from a socket that's no longer this seat's
    // (e.g. after a fresh reconnect replaced it). Internal callers pass no ws.
    if (closingWs !== undefined && seat.ws !== closingWs) return;

    seat.ws = null;
    seat.player.status = 'reconnecting'; // they might come back within the window

    if (this.phase === 'LOBBY') {
      // FIX 4: don't drop the seat on a refresh; give a short window to reconnect.
      seat.reconnectTimer = setTimeout(() => {
        seat.reconnectTimer = null;
        if (seat.player.status !== 'online') {
          this.removeSeat(playerId);
          this.broadcastState();
          if (this.isEmpty) this.startEmptyRoomTimer();
        }
      }, LOBBY_RECONNECT_WINDOW_MS);
    } else {
      // In-game: start reconnect window. When the grace fully expires and the
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
      if (this.phase === 'GAME_OVER' && playerId === this.hostId) {
        this.reassignHostToConnected();
      }

      // NB: we deliberately DON'T touch the turn timer here. A turn's deadline is fixed
      // when it begins, so one player dropping never shortens or resets another player's
      // clock — and a refresh can't reset the dropped player's own clock either.
    }

    // If the room just emptied mid-turn, freeze the remaining turn time so it doesn't
    // tick away while nobody can act; reconnect() restores it on the first return.
    if (this.isEmpty && this.turnExpiresAt != null) {
      this.turnPausedRemainingMs = Math.max(0, this.turnExpiresAt - Date.now());
      this.turnExpiresAt = null;
      this.cancelTurnTimer();
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

    // In-game leave: treat as a permanent disconnect so seat/turn/bid indices stay
    // intact (the seat auto-plays to the end; host leaving ends the game). Hard seat
    // removal mid-round would corrupt game state.
    if (this.phase !== 'LOBBY' && this.phase !== 'GAME_OVER') {
      this.disconnect(playerId);
      return;
    }

    seat.reconnectTimer = this.clearTimer(seat.reconnectTimer);
    this.removeSeat(playerId); // remove the seat entirely

    this.broadcastState();

    if (this.seats.length === 0) {
      this.startEmptyRoomTimer();
    }
  }

  // ─── Lobby ────────────────────────────────────────────────────────────────

  startGame(requesterId: string): ErrorCode | null {
    if (requesterId !== this.hostId) return 'NOT_HOST';
    if (this.phase !== 'LOBBY') return 'WRONG_PHASE';
    if (this.seats.length < 2) return 'NOT_ENOUGH_PLAYERS';

    this.cancelCountdown(); // a manual start supersedes any pending lobby countdown
    this.previousTrump = undefined;
    this.roundIndex = 0;
    this.startRound();
    return null;
  }

  restartGame(requesterId: string): ErrorCode | null {
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
    this.countdownTimer = this.clearTimer(this.countdownTimer);
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

  /**
   * Seat of the trailing (lowest-total) player — picks the trump at Last Stand.
   * Ties break by rotational seat order from this round's first bidder (deterministic,
   * never name-based, so it can't always fall to the same seat).
   */
  private lowestScoreSeatIndex(): number {
    const total = (s: Seat) => latestTotal(this.scoreboard.get(s.player.id) ?? []);
    const min = Math.min(...this.seats.map(total));
    const n = this.seats.length;
    for (let k = 0; k < n; k++) {
      const idx = (this.bidderSeatIndex + k) % n;
      if (total(this.seats[idx]) === min) return idx;
    }
    return this.bidderSeatIndex;
  }

  private startRound(): void {
    this.phase = 'DEALING';
    this.currentRound = this.rounds[this.roundIndex];
    this.bids = new Map(this.seats.map(s => [s.player.id, null]));
    this.tricksWon = new Map(this.seats.map(s => [s.player.id, 0]));
    this.currentTrick = [];
    this.leadSuit = null;
    this.pushed = new Set();
    this.pushDecided = new Set();
    this.pushTimer = this.clearTimer(this.pushTimer);

    const { hands } = deal(this.currentRound, this.seats.length);
    this.seats.forEach((seat, i) => { seat.hand = hands[i]; });

    const firstSeat = firstBidderSeat(this.roundIndex, this.seats.length);
    this.bidderSeatIndex = firstSeat;
    this.trickLeaderSeatIndex = firstSeat;
    this.currentTurnSeatIndex = firstSeat;

    // A round may open with an announcement banner (mode intro / Up & Down milestone):
    // hold the DEALING phase for ANNOUNCE_MS, then begin play. Ordinary rounds start at once.
    this.announcement = announcementFor(this.mode, this.roundIndex, this.rounds);
    if (this.announcement) {
      this.cancelTurnTimer();
      this.turnExpiresAt = null;
      this.broadcastState();
      setTimeout(() => this.beginRoundPlay(), ANNOUNCE_MS);
    } else {
      this.beginRoundPlay();
    }
  }

  // Clear the announcement banner and open the round (trump-select or bidding).
  private beginRoundPlay(): void {
    this.announcement = null;

    // Trump is player-chosen on: Revolving Trump (every round), and Up & Down's
    // Summit (7-card round) + Last Stand (final round).
    const isSummit = isSummitRound(this.mode, this.currentRound!);
    const lastStand = isLastStandRound(this.mode, this.roundIndex, this.rounds.length);
    if (this.mode === 'revolvingTrump' || isSummit || lastStand) {
      this.trump = null;
      this.trumpConfig = null;
      this.phase = 'TRUMP_SELECT';
      // Last Stand: the trailing (lowest-score) player calls it; otherwise the first bidder.
      this.currentTurnSeatIndex = lastStand ? this.lowestScoreSeatIndex() : this.bidderSeatIndex;
    } else {
      const t = pickTrump(this.previousTrump);
      this.previousTrump = t;
      this.trump = t;
      this.trumpConfig = t ? { kind: 'suit', suit: t } : { kind: 'noTrump' };
      this.phase = 'BIDDING';
      this.currentTurnSeatIndex = this.bidderSeatIndex;
    }
    this.beginTurn();        // set the turn deadline BEFORE broadcasting…
    this.broadcastState();   // …so the state carries the fresh countdown
  }

  // ─── Trump selection (Revolving Trump) ────────────────────────────────────

  selectTrump(playerId: string, kind: TrumpKind, suit?: Suit): ErrorCode | null {
    if (this.phase !== 'TRUMP_SELECT') return 'WRONG_PHASE';
    if (this.currentTurnPlayerId() !== playerId) return 'NOT_YOUR_TURN';
    // Last Stand offers only two choices: a trump suit or No Trump.
    // Up & Down's trump rounds (Summit + Last Stand) offer only a suit or No Trump — no specials.
    if (this.mode === 'upDown' && kind !== 'suit' && kind !== 'noTrump') return 'INVALID_TRUMP';
    const cfg = this.buildTrumpConfig(kind, suit);
    if (!cfg) return 'INVALID_TRUMP';
    this.applyTrump(cfg);
    return null;
  }

  private buildTrumpConfig(kind: TrumpKind, suit?: Suit): TrumpConfig | null {
    switch (kind) {
      case 'suit':
        return (suit === 'D' || suit === 'C' || suit === 'H' || suit === 'S') ? { kind: 'suit', suit } : null;
      case 'oneTrump':
        return { kind: 'oneTrump', rank: RANK_ORDER[Math.floor(Math.random() * RANK_ORDER.length)] };
      case 'noTrump': case 'lowCard': case 'ak47': case 'kingQueen':
        return { kind };
      default:
        return null;
    }
  }

  private applyTrump(cfg: TrumpConfig): void {
    this.cancelTurnTimer();
    this.trumpConfig = cfg;
    this.trump = cfg.kind === 'suit' ? (cfg.suit ?? null) : null;
    this.previousTrump = this.trump;
    this.phase = 'BIDDING';
    this.currentTurnSeatIndex = this.bidderSeatIndex; // bidding always opens with the first bidder (the Last Stand picker may differ)
    this.beginTurn();
    this.broadcastState();
  }

  // ─── Bidding ──────────────────────────────────────────────────────────────

  placeBid(playerId: string, bid: number): ErrorCode | null {
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
    this.cancelTurnTimer();

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
      // Blind Bid reveals hands and offers a lock/push before play; others start playing.
      if (this.mode === 'blind') this.startPushPhase();
      else this.startPlaying();
    } else {
      this.currentTurnSeatIndex = next;
      this.beginTurn();
      this.broadcastState();
    }
  }

  private startPlaying(): void {
    this.currentTurnSeatIndex = this.trickLeaderSeatIndex; // first bidder leads first trick
    this.phase = 'PLAYING';
    this.beginTurn();
    this.broadcastState();
  }

  // ─── Push (Blind Bid: lock ×2, or raise the bid by 1 for ×3) ───────────────

  private startPushPhase(): void {
    this.phase = 'PUSH';
    this.cancelTurnTimer();
    this.pushed = new Set();
    this.pushDecided = new Set();
    this.turnExpiresAt = Date.now() + PUSH_TIMEOUT_MS; // drives the client countdown ring
    this.pushTimer = setTimeout(() => this.finishPush(), PUSH_TIMEOUT_MS);
    this.broadcastState();
  }

  pushBid(playerId: string, push: boolean): ErrorCode | null {
    if (this.phase !== 'PUSH') return 'WRONG_PHASE';
    const seat = this.getSeat(playerId);
    if (!seat) return 'NOT_IN_ROOM';
    if (this.pushDecided.has(playerId)) return null; // already decided — ignore repeats
    this.pushDecided.add(playerId);
    const bid = this.bids.get(playerId) ?? 0;
    if (push && bid < (this.currentRound ?? 0)) {
      this.pushed.add(playerId);
      this.bids.set(playerId, bid + 1); // raise the contract by one
    }
    if (this.pushDecided.size >= this.seats.length) this.finishPush();
    else this.broadcastState();
    return null;
  }

  private finishPush(): void {
    this.pushTimer = this.clearTimer(this.pushTimer);
    // Anyone who didn't decide simply LOCKs (stays out of `pushed`).
    this.startPlaying();
  }

  // ─── Playing ──────────────────────────────────────────────────────────────

  playCard(playerId: string, cardId: string): ErrorCode | null {
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

    this.cancelTurnTimer();

    if (this.currentTrick.length === this.seats.length) {
      // Trick complete
      this.resolveTrick();
    } else {
      this.currentTurnSeatIndex = this.nextSeatIndex(this.currentTurnSeatIndex);
      this.beginTurn();
      this.broadcastState();
    }

    return null;
  }

  private resolveTrick(): void {
    const winner = trickWinner(this.currentTrick, this.leadSuit!, this.trumpConfig ?? { kind: 'noTrump' });
    const winnerSeat = this.seats.find(s => s.player.id === winner.playerId)!;
    this.tricksWon.set(winner.playerId, (this.tricksWon.get(winner.playerId) ?? 0) + 1);

    const prevTrick = [...this.currentTrick];
    this.currentTrick = [];
    this.leadSuit = null;
    this.turnExpiresAt = null; // brief trick-display gap has no live countdown
    this.trickLeaderSeatIndex = winnerSeat.player.seatIndex;
    this.currentTurnSeatIndex = this.trickLeaderSeatIndex;

    // Broadcast the completed trick state briefly, then continue
    this.broadcastState(prevTrick);

    // Check if round is over (no cards left)
    if (this.seats[0].hand.length === 0) {
      setTimeout(() => this.endRound(), TRICK_DISPLAY_MS);
    } else {
      setTimeout(() => {
        this.beginTurn();
        this.broadcastState();
      }, TRICK_DISPLAY_MS);
    }
  }

  private endRound(): void {
    this.phase = 'ROUND_SCORING';
    const roundNum = this.currentRound!;

    // Compute deltas
    const perPlayer: MsgRoundResult['perPlayer'] = [];
    // Last Stand's ×10 is a comeback: only the trailing (lowest-total) player(s) earn it.
    const lastStand = isLastStandRound(this.mode, this.roundIndex, this.rounds.length);
    const minTotal = lastStand
      ? Math.min(...this.seats.map(s => latestTotal(this.scoreboard.get(s.player.id) ?? [])))
      : 0;
    for (const seat of this.seats) {
      const pid = seat.player.id;
      const bid = this.bids.get(pid) ?? 0;
      const won = this.tricksWon.get(pid) ?? 0;
      const rows = this.scoreboard.get(pid) ?? [];
      const prevTotal = latestTotal(rows);
      // Blind Bid: lock ×2 / push ×3 per player. Last Stand: ×10 only for the trailing
      // player(s); everyone else ×1. Otherwise the Up & Down round multiplier.
      const perPlayerMultiplier = this.mode === 'blind'
        ? (this.pushed.has(pid) ? 3 : 2)
        : lastStand
        ? (prevTotal === minTotal ? 10 : 1)
        : roundMultiplier(this.mode, this.roundIndex, this.rounds.length, roundNum);
      const delta = scoreRound(bid, won) * perPlayerMultiplier;
      const total = prevTotal + delta;
      rows.push({ round: roundNum, bid, won, delta, total, multiplier: perPlayerMultiplier });
      this.scoreboard.set(pid, rows);
      perPlayer.push({ playerId: pid, name: seat.player.name, bid, won, delta, total });
    }

    // Broadcast round result
    const msg: MsgRoundResult = { type: 'roundResult', round: roundNum, perPlayer };
    this.lastRoundResult = msg;
    this.broadcast(msg);
    this.broadcastState();

    // Advance to next round or end game
    setTimeout(() => {
      this.roundIndex++;
      if (this.roundIndex < this.rounds.length) {
        this.startRound();
      } else {
        this.endGame();
      }
    }, ROUND_END_DELAY_MS);
  }

  private computeFinalScores(): { finalScores: Record<string, number>; playerNames: Record<string, string>; maxScore: number } {
    const finalScores: Record<string, number> = {};
    const playerNames: Record<string, string> = {};
    let maxScore = -Infinity;

    for (const seat of this.seats) {
      const total = latestTotal(this.scoreboard.get(seat.player.id) ?? []);
      finalScores[seat.player.id] = total;
      playerNames[seat.player.id] = seat.player.name;
      if (total > maxScore) maxScore = total;
    }

    return { finalScores, playerNames, maxScore };
  }

  private finishGame(winners: string[], finalScores: Record<string, number>, playerNames: Record<string, string>): void {
    this.phase = 'GAME_OVER';
    this.lastGameOver = { type: 'gameOver', winners, finalScores, playerNames };
    this.startGameOverTimer(); // set gameOverExpiresAt FIRST so the state carries roomExpiresInMs (drives the "Room closes in Xs" countdown)
    this.broadcast(this.lastGameOver);
    this.broadcastState();
  }

  private endGame(): void {
    const { finalScores, playerNames, maxScore } = this.computeFinalScores();
    const winners = Object.entries(finalScores)
      .filter(([, s]) => s === maxScore)
      .map(([id]) => id);
    this.finishGame(winners, finalScores, playerNames);
  }

  // ─── Timers ───────────────────────────────────────────────────────────────

  // Clear a timer handle if set; returns null so the caller can null its field.
  private clearTimer(timer: ReturnType<typeof setTimeout> | null): null {
    if (timer) clearTimeout(timer);
    return null;
  }

  // Begin a NEW turn: fix its absolute deadline once, then arm the auto-move timer.
  // A just-refreshed ('reconnecting') seat still gets the full budget; only a clearly
  // gone ('offline') seat is fast-forwarded so the table doesn't wait on someone absent.
  private beginTurn(): void {
    this.cancelTurnTimer();
    this.turnPausedRemainingMs = null;
    if (this.isEmpty) { this.turnExpiresAt = null; return; } // nobody to act → paused
    const currentSeat = this.seats[this.currentTurnSeatIndex];
    const offline = currentSeat?.player.status === 'offline';
    const duration = offline
      ? DISCONNECTED_AUTO_MOVE_MS
      : ((this.phase === 'BIDDING' || this.phase === 'TRUMP_SELECT') ? BID_TIMEOUT_MS : PLAY_TIMEOUT_MS);
    this.turnExpiresAt = Date.now() + duration;
    this.armTurnTimer();
  }

  // (Re)arm the auto-move timer to the REMAINING time of the current deadline. Never
  // extends it — used on reconnect/resume so a refresh can't reset or lengthen a turn.
  private armTurnTimer(): void {
    this.cancelTurnTimer();
    if (this.turnExpiresAt == null) return;
    const ms = Math.max(0, this.turnExpiresAt - Date.now());
    this.turnTimer = setTimeout(() => { this.autoAction(); }, ms);
  }

  private cancelTurnTimer(): void {
    this.turnTimer = this.clearTimer(this.turnTimer);
  }

  private autoAction(): void {
    if (this.phase === 'TRUMP_SELECT') { this.applyTrump({ kind: 'suit', suit: SUITS[Math.floor(Math.random() * SUITS.length)] }); return; }
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
    this.emptyRoomTimer = this.clearTimer(this.emptyRoomTimer);
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

  private buildState(forPlayerId: string, lastTrick?: TrickCard[]): GameState {
    const seat = this.getSeat(forPlayerId);
    const handCounts: Record<string, number> = {};
    for (const s of this.seats) {
      if (s.player.id !== forPlayerId) {
        handCounts[s.player.id] = s.hand.length;
      }
    }

    const bidsObj = Object.fromEntries(this.bids);
    const tricksWonObj = Object.fromEntries(this.tricksWon);
    const scoreboardObj = Object.fromEntries(this.scoreboard);

    // Use last trick briefly so clients can show the completed trick
    const trickToShow = lastTrick ?? this.currentTrick;
    const turnActive = this.phase === 'BIDDING' || this.phase === 'PLAYING' || this.phase === 'TRUMP_SELECT' || this.phase === 'PUSH';
    // Blind decisions stay visible through PLAYING too (they define the round's ×2/×3).
    const pushStatus: Record<string, 'locked' | 'pushed'> | null =
      (this.phase === 'PUSH' || (this.phase === 'PLAYING' && this.mode === 'blind'))
        ? Object.fromEntries([...this.pushDecided].map(pid => [pid, this.pushed.has(pid) ? 'pushed' : 'locked']))
        : null;

    return {
      phase: this.phase,
      roomId: this.id,
      players: this.seats.map(s => s.player),
      hostId: this.hostId ?? '',
      maxPlayers: this.maxPlayers,
      round: this.currentRound,
      trump: this.trump,
      trumpConfig: this.trumpConfig,
      yourHand: isHandHiddenForBid(this.mode, this.phase) ? [] : (seat?.hand ?? []),
      handCounts,
      bids: bidsObj,
      currentTurn: this.currentTurnPlayerId() || null,
      currentTrick: trickToShow,
      trickLeader: this.seats[this.trickLeaderSeatIndex]?.player.id ?? null,
      scoreboard: scoreboardObj,
      firstBidder: this.seats[this.bidderSeatIndex]?.player.id ?? null,
      tricksWon: tricksWonObj,
      countdownMs: this.countdownEndsAt ? Math.max(0, this.countdownEndsAt - Date.now()) : null,
      turnTimeoutMs: this.phase === 'PUSH'
        ? PUSH_TIMEOUT_MS
        : (this.phase === 'BIDDING' || this.phase === 'TRUMP_SELECT') ? BID_TIMEOUT_MS : PLAY_TIMEOUT_MS,
      turnExpiresAt: turnActive ? this.turnExpiresAt : null,
      turnRemainingMs: turnActive
        ? (this.turnExpiresAt != null ? Math.max(0, this.turnExpiresAt - Date.now()) : this.turnPausedRemainingMs)
        : null,
      roomExpiresInMs: this.gameOverExpiresAt ? Math.max(0, this.gameOverExpiresAt - Date.now()) : null,
      mode: this.mode,
      announcement: this.announcement,
      pushStatus,
    };
  }

  private forEachOpenSeat(cb: (seat: Seat) => void): void {
    for (const seat of this.seats) {
      if (seat.ws?.readyState === WebSocket.OPEN) {
        cb(seat);
      }
    }
  }

  broadcastState(lastTrick?: TrickCard[]): void {
    this.forEachOpenSeat(seat => {
      const state = this.buildState(seat.player.id, lastTrick);
      sendMessage(seat.ws!, { type: 'state', state });
    });
  }

  sendState(ws: WebSocket, playerId: string): void {
    const state = this.buildState(playerId);
    sendMessage(ws, { type: 'state', state });
  }

  // On reconnect, re-send the one-shot messages the client needs for the current phase.
  // They were broadcast once, so a returning player would otherwise miss them and land on
  // the wrong screen (e.g. GAME_OVER state with no winner payload → blank game view).
  resendPhaseExtras(ws: WebSocket): void {
    if (this.phase === 'GAME_OVER') {
      if (this.lastGameOver) sendMessage(ws, this.lastGameOver);
    } else if (this.phase === 'ROUND_SCORING') {
      if (this.lastRoundResult) sendMessage(ws, this.lastRoundResult);
    }
  }

  // ─── Quick chat messages ──────────────────────────────────────────────────

  quickMessage(playerId: string, id: string): void {
    const seat = this.getSeat(playerId);
    if (!seat) return;
    const item = QUICK_MESSAGES.find(m => m.id === id);
    if (!item) return;
    const now = Date.now();
    if (seat.lastQuickMsgAt && now - seat.lastQuickMsgAt < QUICK_MSG_THROTTLE_MS) return; // rate-limit
    seat.lastQuickMsgAt = now;
    this.broadcast({ type: 'quickMessage', senderId: playerId, text: item.text });
  }

  private broadcast(msg: ServerMessage): void {
    this.forEachOpenSeat(seat => {
      sendMessage(seat.ws!, msg);
    });
  }

  getPhase(): GamePhase { return this.phase; }
}
