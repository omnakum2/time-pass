import { v4 as uuidv4 } from 'uuid';
import WebSocket from 'ws';
import {
  Card, GameMode, GamePhase, GameState, Player, RoundScore,
  Suit, TrumpKind, TrumpConfig, TrickCard, ServerMessage, MsgRoundResult, MsgGameOver, ErrorCode, QUICK_MESSAGES, Announcement,
  Settlement, SettlementEntry, UserAccount, CurrencyState,
  roundsForMode, deal, pickTrump, firstBidderSeat,
  legalMoves, trickWinner, scoreRound, roundMultiplier, latestTotal, isHandHiddenForBid, announcementFor, isSummitRound, isLastStandRound, ROUNDS, SUITS, RANK_ORDER, GAME_MODES,
  tableFee, buyInTotal, computePayouts, JACKPOT_MIN_BID, DEFAULT_STARTING_CHIPS,
  isValidBet, isValidStartingChips,
} from 'shared';
import {
  BID_TIMEOUT_MS, PLAY_TIMEOUT_MS, RECONNECT_WINDOW_MS, EMPTY_ROOM_DESTROY_MS,
  GAME_OVER_TTL_MS, COUNTDOWN_MS, DISCONNECTED_AUTO_MOVE_MS, TRICK_DISPLAY_MS, ROUND_END_DELAY_MS,
  LOBBY_RECONNECT_WINDOW_MS, QUICK_MSG_THROTTLE_MS, ANNOUNCE_MS, PUSH_TIMEOUT_MS,
} from './constants';
import { sendMessage, clampPlayers } from './helpers';
import { getIdentity } from './firebase';

export interface Seat {
  player: Player;
  token: string;
  uid?: string;              // V3: authenticated account uid (undefined = anonymous)
  ws: WebSocket | null;
  hand: Card[];
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  lastQuickMsgAt?: number; // rate-limit quick chat messages
}

export class Room {
  readonly id: string;
  maxPlayers: number;
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
  private bidOrder: string[] = [];                       // playerIds in the order they bid this round (jackpot tie-break)

  // ─── Coin Rush (currency mode) state ────────────────────────────────────────
  // All of this is inert (and `currency` is broadcast as null) unless mode === 'coinRush'.
  private betAmount = 0;                                  // per-seat coin buy-in
  private fee = 0;                                        // per-seat burned table fee (tableFee(betAmount))
  private startingChips = DEFAULT_STARTING_CHIPS;         // each seat's opening chip stack
  private chips: Map<string, number> = new Map();        // playerId → current chip stack
  private jackpot = 0;                                    // progressive jackpot (chips), fills on misses
  private pool = 0;                                       // prize pool = betAmount × non-forfeited buy-ins (fee excluded)
  private eliminated: string[] = [];                     // playerIds in bust order, earliest first
  private forfeited: string[] = [];                      // playerIds who quit mid-game (coins burned, out of ranking)
  private chipsAtBust: Map<string, number> = new Map();  // playerId → chip stack captured at bust (tie-break)
  private frozen: Set<string> = new Set();               // play-machinery freeze set (eliminated∪forfeited), recomputed each round
  private startNonce = 0;                                 // bumped each start → unique gameId per match attempt
  private gameId: string | null = null;                  // `${roomId}-${startNonce}` — the reservation key
  private settled = false;                               // guard: settlement already applied
  private refunded = false;                              // guard: refund already applied
  private aborted = false;                               // guard: abort already ran
  private finishing = false;                             // guard: end-of-game already entered

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

  // V3: match a seat by authenticated uid (identity-based reconnect).
  private getSeatByUid(uid: string): Seat | undefined {
    return this.seats.find(s => s.uid === uid);
  }

  private currentTurnPlayerId(): string {
    return this.seats[this.currentTurnSeatIndex]?.player.id ?? '';
  }

  private nextSeatIndex(from: number): number {
    const n = this.seats.length;
    let idx = (from + 1) % n;
    // Coin Rush: skip seats frozen out of this round (busted or forfeited last round).
    if (this.mode === 'coinRush') {
      let steps = 0;
      while (this.frozen.has(this.seats[idx].player.id) && steps < n) { idx = (idx + 1) % n; steps++; }
    }
    return idx;
  }

  // ─── Coin Rush helpers ──────────────────────────────────────────────────────
  // Seats still dealt-in for the CURRENT round (frozen = busted/forfeited before it began).
  private activeSeats(): Seat[] {
    return this.seats.filter(s => !this.frozen.has(s.player.id));
  }
  // Players still in contention for the prize pool (accounting view, updates immediately
  // on a mid-round forfeit — unlike `frozen`, which only changes at round boundaries).
  private contenders(): string[] {
    return this.seats
      .map(s => s.player.id)
      .filter(pid => !this.eliminated.includes(pid) && !this.forfeited.includes(pid));
  }
  private uidFor(playerId: string): string | undefined {
    return this.getSeat(playerId)?.uid;
  }
  // Push each still-connected seat its freshly-mutated wallet (post debit/settle/refund).
  private pushAccounts(accounts: Record<string, UserAccount>): void {
    for (const seat of this.seats) {
      const uid = seat.uid;
      if (!uid) continue;
      const acc = accounts[uid];
      if (acc && seat.ws?.readyState === WebSocket.OPEN) {
        sendMessage(seat.ws, { type: 'account', account: acc });
      }
    }
  }

  // Host lobby config for a Coin Rush room (betAmount already validated by index.ts).
  setCurrencyConfig(betAmount: number, startingChips: number): void {
    this.betAmount = betAmount;
    this.fee = tableFee(betAmount);
    this.startingChips = startingChips;
  }
  getMode(): GameMode { return this.mode; }
  getBetAmount(): number { return this.betAmount; }

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

  // Hand the host role to another present player — prefer an online seat, else a
  // reconnecting one, so the host never sticks to a definitively-gone (offline) player.
  // The caller broadcasts the resulting state.
  private reassignHostToConnected(): void {
    const next = this.seats.find(s => s.player.status === 'online')
              ?? this.seats.find(s => s.player.status === 'reconnecting');
    if (next && next.player.id !== this.hostId) {
      this.hostId = next.player.id;
    }
  }

  // ─── Join / Create ────────────────────────────────────────────────────────

  addPlayer(ws: WebSocket, name: string, asHost = false, uid?: string): Seat | null {
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
      uid,
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

  reconnect(ws: WebSocket, token: string, uid?: string): Seat | null {
    // V3: prefer identity (uid) so a signed-in player recovers their seat even if the
    // local reconnect token was lost; fall back to the per-seat token (anonymous path).
    const seat = (uid ? this.getSeatByUid(uid) : undefined) ?? this.getSeatByToken(token);
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
    if (this.phase === 'BIDDING' || this.phase === 'PLAYING' || this.phase === 'TRUMP_SELECT') {
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

    if (this.phase === 'LOBBY') {
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
      if (this.phase === 'GAME_OVER' && playerId === this.hostId) {
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
               (this.phase === 'BIDDING' || this.phase === 'PLAYING' || this.phase === 'TRUMP_SELECT')) {
      this.turnExpiresAt = Date.now() + DISCONNECTED_AUTO_MOVE_MS;
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
    if (this.phase !== 'LOBBY' && this.phase !== 'GAME_OVER') {
      // Coin Rush: a mid-game quit FORFEITS the buy-in (stays burned) — handled specially
      // so the pool/ranking update and the game finishes/aborts if too few remain.
      if (this.mode === 'coinRush' && this.gameId && !this.settled && !this.refunded && !this.aborted) {
        this.forfeitPlayer(playerId);
        return;
      }
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

  // ─── Lobby ────────────────────────────────────────────────────────────────

  async startGame(requesterId: string): Promise<ErrorCode | null> {
    if (requesterId !== this.hostId) return 'NOT_HOST';
    if (this.phase !== 'LOBBY') return 'WRONG_PHASE';
    if (this.seats.length < 2) return 'NOT_ENOUGH_PLAYERS';

    this.cancelCountdown(); // a manual start supersedes any pending lobby countdown
    this.previousTrump = undefined;
    this.roundIndex = 0;
    if (this.mode === 'coinRush') return this.startGameCoinRush(); // debits buy-ins first
    this.startRound();
    return null;
  }

  // Host-only lobby settings edit: change capacity and/or mode before a match starts.
  // Coin Rush also carries the coin buy-in + starting-chip stack. Everything is
  // validated BEFORE any field is mutated so a rejected edit leaves settings intact.
  updateRoomSettings(requesterId: string, maxPlayers?: number, mode?: GameMode, betAmount?: number, startingChips?: number): ErrorCode | null {
    if (requesterId !== this.hostId) return 'NOT_HOST';
    if (this.phase !== 'LOBBY') return 'WRONG_PHASE';

    let newMax = this.maxPlayers;
    if (maxPlayers !== undefined) {
      if (!Number.isFinite(maxPlayers)) return 'INVALID_SETTINGS';
      const clamped = clampPlayers(maxPlayers);           // clamps to [2,7]
      if (clamped < this.seats.length) return 'INVALID_SETTINGS'; // can't drop below seated players
      newMax = clamped;
    }
    let newMode = this.mode;
    if (mode !== undefined) {
      if (!GAME_MODES.some(m => m.id === mode)) return 'INVALID_SETTINGS';
      newMode = mode;
    }
    // Coin Rush economy, validated against the EFFECTIVE mode (index.ts already
    // range-checks, but the room is authoritative — reject anything invalid here too).
    let newBet = this.betAmount, newFee = this.fee, newChips = this.startingChips;
    if (newMode === 'coinRush') {
      newBet = betAmount ?? this.betAmount;
      newChips = startingChips ?? (this.startingChips || DEFAULT_STARTING_CHIPS);
      if (!isValidBet(newBet) || !isValidStartingChips(newChips)) return 'INVALID_SETTINGS';
      newFee = tableFee(newBet);
    }

    // All valid → apply.
    this.maxPlayers = newMax;
    this.mode = newMode;
    this.rounds = roundsForMode(newMode);
    this.betAmount = newBet; this.fee = newFee; this.startingChips = newChips;
    // A host settings edit always cancels a pending auto-start countdown — the host is
    // actively configuring; they'll press Start manually, or a fresh join re-arms the
    // normal full-room countdown.
    this.cancelCountdown();
    this.broadcastState();
    return null;
  }

  // "Play Again" returns everyone to the LOBBY (rather than dealing at once) so the
  // host can adjust settings before starting the next match. The host presses Start
  // manually, or a fresh join re-triggers the normal full-room countdown.
  restartGame(requesterId: string): ErrorCode | null {
    if (requesterId !== this.hostId) return 'NOT_HOST';
    if (this.phase !== 'GAME_OVER') return 'WRONG_PHASE';

    // A rematch cancels the pending game-over cleanup
    this.cancelGameOverTimer();

    // Prune ghost seats: a player who dropped mid-game and won't return ('offline')
    // would otherwise linger as a phantom lobby player counting toward capacity/Start.
    // Keep 'online' and 'reconnecting' seats. removeSeat mutates this.seats (host
    // reassign + reindex + scoreboard delete), so collect the ids first.
    const gone = this.seats.filter(s => s.player.status === 'offline').map(s => s.player.id);
    gone.forEach(id => this.removeSeat(id));

    // reset per-match state
    this.previousTrump = undefined;
    this.roundIndex = 0;
    this.scoreboard = new Map(this.seats.map(s => [s.player.id, []]));
    this.bids = new Map();
    this.tricksWon = new Map();
    this.currentTrick = [];
    this.leadSuit = null;
    // clear each surviving seat's hand + null out the finished game's stale round state
    this.seats.forEach(s => { s.hand = []; });
    this.trump = null;
    this.trumpConfig = null;
    this.currentRound = null;
    this.lastRoundResult = null;
    // clear the round announcement + blind-push tracking
    this.announcement = null;
    this.pushed.clear();
    this.pushDecided.clear();
    // clear the stored game-over so a reconnect won't re-show the winner screen
    this.lastGameOver = null;
    this.bidOrder = [];

    // Coin Rush: clear the finished match's economy so the next game starts fresh.
    // (betAmount/fee/startingChips are room settings and intentionally persist.)
    this.chips = new Map();
    this.jackpot = 0;
    this.pool = 0;
    this.eliminated = [];
    this.forfeited = [];
    this.chipsAtBust = new Map();
    this.frozen = new Set();
    this.gameId = null;
    this.settled = false; this.refunded = false; this.aborted = false; this.finishing = false;

    // Return to the lobby; do NOT deal or start the countdown here.
    this.phase = 'LOBBY';
    this.broadcastState();
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
    if (this.mode === 'coinRush') { void this.startGameCoinRush(); return; } // debits buy-ins first
    this.startRound();
  }

  // ─── Coin Rush start: debit every seat's buy-in, then deal ───────────────────
  // Real Coins move here. Every debit is an idempotent Firestore txn keyed by gameId;
  // if ANY seat can't pay we refund the whole attempt and stay in the lobby.
  private async startGameCoinRush(): Promise<ErrorCode | null> {
    const betAmount = this.betAmount, fee = this.fee, buyIn = buyInTotal(betAmount);
    const seatsToCharge = [...this.seats];

    // Pre-flight: every seat must be a signed-in account that can afford the buy-in.
    // (The debitBuyIn txn is the authoritative re-check — this just fails fast.)
    for (const seat of seatsToCharge) {
      if (!seat.uid) return 'INSUFFICIENT_BALANCE'; // anonymous seats can't buy in
      try {
        const acc = await getIdentity().getOrCreateUser(seat.uid, seat.player.name);
        if (acc.coins < buyIn) return 'INSUFFICIENT_BALANCE';
      } catch { return 'INSUFFICIENT_BALANCE'; }
    }

    // Fresh reservation for this attempt.
    this.startNonce++;
    this.gameId = `${this.id}-${this.startNonce}`;
    this.settled = false; this.refunded = false; this.aborted = false; this.finishing = false;
    this.chips = new Map(); this.jackpot = 0; this.pool = 0;
    this.eliminated = []; this.forfeited = []; this.chipsAtBust = new Map(); this.frozen = new Set();

    try {
      for (const seat of seatsToCharge) {
        const acc = await getIdentity().debitBuyIn(this.gameId, seat.uid!, betAmount, fee);
        if (seat.ws?.readyState === WebSocket.OPEN) sendMessage(seat.ws, { type: 'account', account: acc });
        this.chips.set(seat.player.id, this.startingChips);
      }
    } catch {
      // A debit failed after others succeeded → refund the whole attempt, stay in lobby.
      let accounts: Record<string, UserAccount> = {};
      try { accounts = await getIdentity().refundGame(this.gameId); this.refunded = true; }
      catch { /* left 'open' — the periodic stuck-sweep will refund it */ }
      this.pushAccounts(accounts);
      this.gameId = null;
      return 'INSUFFICIENT_BALANCE';
    }

    // Pool is betAmount-only (the fee is already burned). jackpot starts at 0.
    this.pool = betAmount * seatsToCharge.length;
    this.startRound();
    return null;
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
    this.bidOrder = [];

    // Coin Rush: freeze busted + forfeited players out of the WHOLE round (dealing,
    // bidding, play). The freeze set is fixed for the round so mid-round forfeits (which
    // still auto-play out the current round) never corrupt trick sizing / turn order.
    if (this.mode === 'coinRush') this.frozen = new Set([...this.eliminated, ...this.forfeited]);
    const participants = this.mode === 'coinRush' ? this.activeSeats() : this.seats;

    this.bids = new Map(participants.map(s => [s.player.id, null]));
    this.tricksWon = new Map(participants.map(s => [s.player.id, 0]));
    this.currentTrick = [];
    this.leadSuit = null;
    this.trump = null;        // clear last round's trump so the DEALING/announcement window
    this.trumpConfig = null;  // never shows a stale trump — beginRoundPlay sets the new one
    this.pushed = new Set();
    this.pushDecided = new Set();
    this.pushTimer = this.clearTimer(this.pushTimer);

    const { hands } = deal(this.currentRound, participants.length);
    if (this.mode === 'coinRush') {
      this.seats.forEach(s => { s.hand = []; });               // frozen seats get no cards
      participants.forEach((seat, i) => { seat.hand = hands[i]; });
    } else {
      this.seats.forEach((seat, i) => { seat.hand = hands[i]; });
    }

    let firstSeat = firstBidderSeat(this.roundIndex, this.seats.length);
    // Coin Rush: the computed opening seat may be frozen — advance to the next active one.
    if (this.mode === 'coinRush' && this.frozen.has(this.seats[firstSeat].player.id)) {
      firstSeat = this.nextSeatIndex(firstSeat);
    }
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
    // Coin Rush: a forfeit during the DEALING/announcement window may have already
    // early-finished the game — never re-open a round on top of GAME_OVER.
    if (this.phase === 'GAME_OVER' || this.finishing) return;
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
    if (!this.bidOrder.includes(playerId)) this.bidOrder.push(playerId); // for the jackpot tie-break
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

    // Coin Rush: a trick is complete once every dealt-in (active) seat has played.
    const trickSize = this.mode === 'coinRush' ? this.activeSeats().length : this.seats.length;
    if (this.currentTrick.length === trickSize) {
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

    // Check if round is over (no cards left). Coin Rush: check an ACTIVE seat — a frozen
    // seat's hand is always empty and would end the round prematurely.
    const refSeat = this.mode === 'coinRush' ? this.activeSeats()[0] : this.seats[0];
    if ((refSeat?.hand.length ?? 0) === 0) {
      setTimeout(() => this.endRound(), TRICK_DISPLAY_MS);
    } else {
      setTimeout(() => {
        if (this.phase === 'GAME_OVER' || this.finishing) return; // a forfeit may have finished the game mid-gap
        this.beginTurn();
        this.broadcastState();
      }, TRICK_DISPLAY_MS);
    }
  }

  private endRound(): void {
    if (this.phase === 'GAME_OVER') return; // a mid-round forfeit may have already finished the game
    this.phase = 'ROUND_SCORING';
    const roundNum = this.currentRound!;

    if (this.mode === 'coinRush') { this.endRoundCoinRush(roundNum); return; }

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

  private finishGame(winners: string[], finalScores: Record<string, number>, playerNames: Record<string, string>, settlement?: Settlement): void {
    this.phase = 'GAME_OVER';
    // `settlement` is coinRush-only; omitting the key keeps the other 4 modes' payload identical.
    this.lastGameOver = { type: 'gameOver', winners, finalScores, playerNames, ...(settlement ? { settlement } : {}) };
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

  // ─── Coin Rush: round scoring, jackpot, bust-out ────────────────────────────

  private endRoundCoinRush(roundNum: number): void {
    const perPlayer: MsgRoundResult['perPlayer'] = [];
    // Score every seat dealt into this round (multiplier is always ×1 in Coin Rush).
    for (const seat of this.activeSeats()) {
      const pid = seat.player.id;
      const bid = this.bids.get(pid) ?? 0;
      const won = this.tricksWon.get(pid) ?? 0;
      const rows = this.scoreboard.get(pid) ?? [];
      const prevTotal = latestTotal(rows);
      const delta = scoreRound(bid, won); // ×1 — Coin Rush applies no mode scaling
      const total = prevTotal + delta;
      rows.push({ round: roundNum, bid, won, delta, total, multiplier: 1 });
      this.scoreboard.set(pid, rows);
      // Chips move by the same delta; every chip LOST feeds the progressive jackpot.
      this.chips.set(pid, (this.chips.get(pid) ?? 0) + delta);
      if (delta < 0) this.jackpot += -delta;
      perPlayer.push({ playerId: pid, name: seat.player.name, bid, won, delta, total });
    }

    this.claimJackpot();     // biggest exact-hit of a bid ≥ JACKPOT_MIN_BID scoops the pot
    this.processBustOuts();  // anyone at ≤0 chips is frozen out of all remaining rounds

    const msg: MsgRoundResult = { type: 'roundResult', round: roundNum, perPlayer };
    this.lastRoundResult = msg;
    this.broadcast(msg);
    this.broadcastState();

    setTimeout(() => {
      if (this.phase === 'GAME_OVER' || this.finishing) return; // a forfeit may have finished it
      this.roundIndex++;
      // End when the rounds run out OR ≤1 player is still in contention (early finish).
      if (this.roundIndex < this.rounds.length && this.contenders().length > 1) {
        this.startRound();
      } else {
        void this.endGameCoinRush();
      }
    }, ROUND_END_DELAY_MS);
  }

  // The whole jackpot goes to the biggest exact-hit of a bid ≥ JACKPOT_MIN_BID this round.
  // Tie on bid size → the earliest bidder (this round's bid order) wins it.
  private claimJackpot(): void {
    if (this.jackpot <= 0) return;
    const candidates = this.activeSeats()
      .map(s => s.player.id)
      .filter(pid => {
        if (this.forfeited.includes(pid)) return false; // a forfeiter can't scoop
        const bid = this.bids.get(pid) ?? 0;
        const won = this.tricksWon.get(pid) ?? 0;
        return bid >= JACKPOT_MIN_BID && won === bid;
      });
    if (candidates.length === 0) return;

    let winner = candidates[0];
    let bestBid = this.bids.get(winner) ?? 0;
    let bestOrder = this.bidOrder.indexOf(winner);
    for (const pid of candidates) {
      const bid = this.bids.get(pid) ?? 0;
      const order = this.bidOrder.indexOf(pid);
      if (bid > bestBid || (bid === bestBid && order < bestOrder)) {
        winner = pid; bestBid = bid; bestOrder = order;
      }
    }
    this.chips.set(winner, (this.chips.get(winner) ?? 0) + this.jackpot);
    this.jackpot = 0;
  }

  private processBustOuts(): void {
    const busted = this.activeSeats()
      .map(s => s.player.id)
      .filter(pid => !this.forfeited.includes(pid) && (this.chips.get(pid) ?? 0) <= 0);
    if (busted.length === 0) return;
    // Multiple busts the same round: lower chips-at-bust is added first → earlier in
    // `eliminated` → lower final rank (so the worse stack ranks below the less-bad one).
    busted.sort((a, b) => (this.chips.get(a) ?? 0) - (this.chips.get(b) ?? 0));
    for (const pid of busted) {
      this.chipsAtBust.set(pid, this.chips.get(pid) ?? 0);
      this.eliminated.push(pid);
    }
  }

  // ─── Coin Rush: end of game — rank, pay out from the pool, settle on Firebase ─
  private async endGameCoinRush(): Promise<void> {
    if (this.finishing || this.phase === 'GAME_OVER') return; // one settlement only
    this.finishing = true;
    this.cancelTurnTimer();
    this.turnExpiresAt = null;

    // Survivors (still in contention) ranked by chips DESC; equal chips = a tie-group.
    const survivors = this.contenders();
    survivors.sort((a, b) => (this.chips.get(b) ?? 0) - (this.chips.get(a) ?? 0));
    const rankGroups: string[][] = [];
    let i = 0;
    while (i < survivors.length) {
      const group = [survivors[i]];
      let j = i + 1;
      while (j < survivors.length && (this.chips.get(survivors[j]) ?? 0) === (this.chips.get(survivors[i]) ?? 0)) {
        group.push(survivors[j]); j++;
      }
      rankGroups.push(group); i = j;
    }
    // Then the eliminated, in REVERSE bust order (later bust ranks higher). Same-round
    // busts were pushed lowest-chips-first, so reversing puts higher chips-at-bust first.
    for (const pid of [...this.eliminated].reverse()) rankGroups.push([pid]);

    // Pool = betAmount × non-forfeited buy-ins (forfeiters' stakes stay burned).
    const nonForfeited = survivors.length + this.eliminated.length;
    const pool = this.betAmount * nonForfeited;
    this.pool = pool;
    const coinsByPlayer = computePayouts(rankGroups, pool, nonForfeited);

    // Map playerId → uid and settle on Firebase (idempotent). Guard against a game that
    // was already refunded/aborted (shouldn't reach here, but never double-move coins).
    const coinsByUid: Record<string, number> = {};
    for (const [pid, coins] of Object.entries(coinsByPlayer)) {
      const uid = this.uidFor(pid);
      if (uid) coinsByUid[uid] = (coinsByUid[uid] ?? 0) + coins;
    }
    let accounts: Record<string, UserAccount> = {};
    if (this.gameId && !this.settled && !this.refunded && !this.aborted) {
      try {
        accounts = await getIdentity().settleGame(this.gameId, coinsByUid);
        this.settled = true;
      } catch { /* settlement failed — reservation stays 'open' for the stuck-sweep */ }
    }

    // Build the settlement block (ranked players + forfeiters for full client info).
    const rank = rankGroups.flat();
    const buyIn = buyInTotal(this.betAmount);
    const payouts: Record<string, SettlementEntry> = {};
    for (const pid of rank) {
      const won = coinsByPlayer[pid] ?? 0;
      const chips = this.eliminated.includes(pid) ? (this.chipsAtBust.get(pid) ?? 0) : (this.chips.get(pid) ?? 0);
      payouts[pid] = { chips, coinsWon: won, net: won - buyIn };
    }
    for (const pid of this.forfeited) { // not ranked; stake burned
      payouts[pid] = { chips: this.chips.get(pid) ?? 0, coinsWon: 0, net: -buyIn };
    }
    const settlement: Settlement = { rank, payouts };

    // Base gameOver payload uses chip stacks as the "score"; winners = the top tie-group.
    const finalScores: Record<string, number> = {};
    const playerNames: Record<string, string> = {};
    for (const s of this.seats) {
      playerNames[s.player.id] = s.player.name;
      finalScores[s.player.id] = this.chips.get(s.player.id) ?? 0;
    }
    const winners = rankGroups.length > 0 ? rankGroups[0] : [];

    this.pushAccounts(accounts);               // updated wallets first…
    this.finishGame(winners, finalScores, playerNames, settlement); // …then GAME_OVER + settlement
  }

  // Refund a Coin Rush game that can never settle (whole table gone, shutdown/drain).
  // A single quitter is a FORFEIT (handled in forfeitPlayer), NOT an abort. Idempotent.
  async abortGame(): Promise<void> {
    if (this.mode !== 'coinRush' || !this.gameId) return;
    if (this.settled || this.refunded || this.aborted) return;
    try {
      const accounts = await getIdentity().refundGame(this.gameId);
      this.refunded = true;
      this.aborted = true;
      this.pushAccounts(accounts);
    } catch { /* reservation stays 'open'; the periodic stuck-sweep will refund it */ }
  }

  // A mid-game quit in a started Coin Rush game: the leaver FORFEITS. Their reserved
  // coins stay burned (no refund); they leave the ranking and the pool shrinks by their
  // betAmount. The game continues if ≥2 remain in contention; 1 → early finish; 0 → abort.
  private forfeitPlayer(playerId: string): void {
    if (!this.getSeat(playerId)) return;
    if (!this.forfeited.includes(playerId) && !this.eliminated.includes(playerId)) {
      this.forfeited.push(playerId);
      this.pool = Math.max(0, this.pool - this.betAmount);
    }
    const remaining = this.contenders().length;
    if (remaining <= 0) {
      this.disconnect(playerId, undefined, { immediate: true });
      void this.abortGame();
      return;
    }
    if (remaining === 1) {
      this.disconnect(playerId, undefined, { immediate: true });
      void this.endGameCoinRush(); // sole survivor takes 1st
      return;
    }
    // ≥2 remain: standard immediate-leave teardown. The forfeiter is not yet in `frozen`
    // (that set only changes at startRound), so the current round finishes with them
    // auto-played as an offline seat; from the next round they're frozen out.
    this.disconnect(playerId, undefined, { immediate: true });
  }

  // Run abort-refund (if applicable) then the destroy callback. Fired from the
  // empty-room and game-over TTL timers, and the shutdown-drain path (via abortGame).
  private runDestroy(): void {
    void (async () => { await this.abortGame(); this.onDestroy?.(); })();
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
      this.runDestroy(); // Coin Rush: refund the open reservation before the room is dropped
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
      this.runDestroy(); // settled coinRush → abortGame is a guarded no-op; unsettled → refund
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
      // Coin Rush live economy (chips/pool/jackpot/eliminated); null for the other 4 modes.
      currency: this.mode === 'coinRush' ? this.buildCurrencyState() : null,
    };
  }

  // Snapshot of the Coin Rush economy for the client (chips as a plain Record).
  private buildCurrencyState(): CurrencyState {
    return {
      betAmount: this.betAmount,
      fee: this.fee,
      pool: this.pool,
      startingChips: this.startingChips,
      chips: Object.fromEntries(this.chips),
      jackpot: this.jackpot,
      eliminated: [...this.eliminated],
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
