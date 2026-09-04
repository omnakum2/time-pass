import WebSocket from 'ws';
import {
  Card, Suit, TrickCard, Announcement, ClientMessage, ErrorCode, ThosoState,
  createDeck, shuffle, topCard, eligibleTransferTargets, isTransferable, legalPlays, isThoso,
  highestLedSuitPlayer, RANK_ORDER, GAMES,
} from 'shared';
import {
  PLAY_TIMEOUT_MS, ANNOUNCE_MS,
  PENALTY_REVEAL_MS, TRICK_DISPLAY_MS,
} from '../../constants';
import { sendMessage, clampPlayers } from '../../helpers';
import { BaseRoom, Seat } from '../BaseRoom';

// Thoso's player cap comes from the shared game registry — the single source of truth.
export const THOSO_MAX_PLAYERS = GAMES.find((g) => g.id === 'thoso')?.maxPlayers ?? 6;

/**
 * Server engine for **Thoso** — a two-phase transfer-and-shedding card game.
 *
 * Phase 1 (`TRANSFER`): the 52-card deck is drawn from a central pile; drawn/own
 * cards are handed to the holder of the cyclic predecessor rank; missing a
 * mandatory transfer costs penalty cards. Each seat's `hand` is its accumulating
 * pile. When all 52 cards have left the pile, Phase 2 begins.
 *
 * Phase 2 (`PLAYING`): a no-trump, follow-suit shedding game. Players empty their
 * hands round by round; a "thoso" (off-suit discard when void) dumps the round's
 * pile on the current led-suit leader. Finishing order fills `finishedRanks`; the
 * last player left holding cards is the loser.
 *
 * Room/lobby/connection/turn-timer plumbing mirrors {@link BidBaaziRoom} exactly.
 */
export class ThosoRoom extends BaseRoom {
  private phase: ThosoState['phase'] = 'LOBBY';

  // ─── Game state ─────────────────────────────────────────────────────────────
  private deck: Card[] = [];                                   // central draw pile (Phase 1)
  private ledSuit: Suit | null = null;                        // Phase 2 current round's led suit
  private currentTrick: TrickCard[] = [];                     // Phase 2 cards played this round
  private finishedRanks: { playerId: string; rank: number }[] = []; // finishing order (1 = first out)
  private drawnCard: Card | null = null;                      // Phase 1: current player's face-up just-drawn card awaiting a transfer decision (public)
  private playersInRound = 0;                                 // active seats when the current Phase-2 round began
  private openingLeadPending = false;                         // Phase-2: the A♠ opening lead is still owed
  private penaltyReveal: { playerId: string; cards: Card[] } | null = null; // private missed-transfer reveal
  private penaltyRevealTimer: ReturnType<typeof setTimeout> | null = null;
  private roundResolving = false;                             // Phase-2: a completed round is held on screen before clearing
  private roundHoldTimer: ReturnType<typeof setTimeout> | null = null;

  private announcement: Announcement | null = null;    // banner (phase intro / THOSO! / penalty)
  private announcementTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(id: string, maxPlayers = THOSO_MAX_PLAYERS) {
    super(id, maxPlayers); // BaseRoom clamps to [2,7]
  }

  // ─── Seat helpers ─────────────────────────────────────────────────────────

  // Live-turn phases — drives the shared reconnect/disconnect turn-timer resume.
  protected isTurnPhase(): boolean {
    return this.phase === 'TRANSFER' || this.phase === 'PLAYING';
  }

  private isFinished(playerId: string): boolean {
    return this.finishedRanks.some(f => f.playerId === playerId);
  }

  private activeSeatCount(): number {
    return this.seats.filter(s => !this.isFinished(s.player.id)).length;
  }

  // First non-finished seat AFTER `from` (wraps). Falls back to `from` if none.
  private nextActiveSeatIndex(from: number): number {
    const n = this.seats.length;
    for (let k = 1; k <= n; k++) {
      const idx = (from + k) % n;
      if (!this.isFinished(this.seats[idx].player.id)) return idx;
    }
    return from;
  }

  private firstActiveSeatIndex(): number {
    const i = this.seats.findIndex(s => !this.isFinished(s.player.id));
    return i >= 0 ? i : 0;
  }

  // playerId → their pile/hand (live references; callers only read).
  private handsMap(): Record<string, Card[]> {
    const m: Record<string, Card[]> = {};
    for (const s of this.seats) m[s.player.id] = s.hand;
    return m;
  }

  // Lowest card by ACE-HIGH ranking (index 0 = '2' is lowest).
  private lowestCard(cards: Card[]): Card {
    return cards.reduce((lo, c) =>
      RANK_ORDER.indexOf(c.rank) < RANK_ORDER.indexOf(lo.rank) ? c : lo);
  }

  // BaseRoom handles filter + reindex + host promotion; cancel a stale lobby
  // countdown if the room is no longer full.
  protected override removeSeat(playerId: string): void {
    super.removeSeat(playerId);
    if (this.countdownTimer && this.seats.length < this.maxPlayers) this.cancelCountdown();
  }

  // ─── Lobby ────────────────────────────────────────────────────────────────

  startGame(requesterId: string): ErrorCode | null {
    if (requesterId !== this.hostId) return 'NOT_HOST';
    if (this.phase !== 'LOBBY') return 'WRONG_PHASE';
    if (this.seats.length < 2) return 'NOT_ENOUGH_PLAYERS';
    this.cancelCountdown();
    this.beginTransferPhase();
    return null;
  }

  // Host-only lobby capacity edit (Thoso has no modes).
  updateRoomSettings(requesterId: string, maxPlayers?: number): ErrorCode | null {
    if (requesterId !== this.hostId) return 'NOT_HOST';
    if (this.phase !== 'LOBBY') return 'WRONG_PHASE';
    if (maxPlayers !== undefined) {
      if (!Number.isFinite(maxPlayers)) return 'INVALID_SETTINGS';
      const clamped = Math.min(clampPlayers(maxPlayers), THOSO_MAX_PLAYERS);
      if (clamped < this.seats.length) return 'INVALID_SETTINGS';
      this.maxPlayers = clamped;
    }
    this.cancelCountdown();
    this.broadcastState();
    return null;
  }

  // "Play Again" returns everyone to the LOBBY and prunes ghost (offline) seats.
  restartGame(requesterId: string): ErrorCode | null {
    if (requesterId !== this.hostId) return 'NOT_HOST';
    if (this.phase !== 'GAME_OVER') return 'WRONG_PHASE';

    this.cancelGameOverTimer();

    const gone = this.seats.filter(s => s.player.status === 'offline').map(s => s.player.id);
    gone.forEach(id => this.removeSeat(id));

    this.deck = [];
    this.ledSuit = null;
    this.currentTrick = [];
    this.drawnCard = null;
    this.openingLeadPending = false;
    this.penaltyReveal = null;
    this.penaltyRevealTimer = this.clearTimer(this.penaltyRevealTimer);
    this.roundHoldTimer = this.clearTimer(this.roundHoldTimer);
    this.roundResolving = false;
    this.finishedRanks = [];
    this.playersInRound = 0;
    this.currentTurnSeatIndex = 0;
    this.setAnnouncement(null);
    this.seats.forEach(s => { s.hand = []; });

    this.phase = 'LOBBY';
    this.broadcastState();
    return null;
  }

  protected beginGame(): void {
    if (this.phase !== 'LOBBY') return;
    if (this.seats.length < 2) { this.cancelCountdown(); return; }
    this.beginTransferPhase();
  }

  // ─── Phase 1 — Draw & Transfer ──────────────────────────────────────────────

  private beginTransferPhase(): void {
    this.phase = 'TRANSFER';
    this.deck = shuffle(createDeck());
    this.seats.forEach(s => { s.hand = []; });
    this.finishedRanks = [];
    this.ledSuit = null;
    this.currentTrick = [];
    this.drawnCard = null;
    this.openingLeadPending = false;
    this.penaltyReveal = null;
    this.currentTurnSeatIndex = 0; // first seat opens Phase 1
    this.setAnnouncement({ title: 'Transfer Phase', subtitle: 'Draw & pass your cards', variant: 'intro' });
    this.beginTurn();
    this.broadcastState();
  }

  // Transfer one card — the player's own pile TOP card OR the face-up drawn card —
  // onto the top of an eligible target's pile. Only the current player, only during
  // Phase 1. The turn continues (they may transfer again or draw).
  private thosoTransfer(playerId: string, cardId: string, toPlayerId: string): ErrorCode | null {
    if (this.phase !== 'TRANSFER') return 'WRONG_PHASE';
    if (this.currentTurnPlayerId() !== playerId) return 'NOT_YOUR_TURN';
    const seat = this.getSeat(playerId);
    if (!seat) return 'NOT_IN_ROOM';

    // Source is either the pending drawn card or the player's own pile top card.
    const ownTop = topCard(seat.hand);
    let card: Card | undefined;
    let fromDrawn = false;
    if (this.drawnCard && this.drawnCard.id === cardId) {
      card = this.drawnCard;
      fromDrawn = true;
    } else if (ownTop && ownTop.id === cardId) {
      card = ownTop;
    }
    if (!card) return 'CARD_NOT_IN_HAND';

    const target = this.getSeat(toPlayerId);
    if (!target || target.player.id === playerId) return 'ILLEGAL_CARD';
    // Target must have the transfer-predecessor rank showing on its pile top.
    const targets = eligibleTransferTargets(card.rank, this.handsMap(), playerId);
    if (!targets.includes(toPlayerId)) return 'ILLEGAL_CARD';

    if (fromDrawn) {
      this.drawnCard = null;
    } else {
      seat.hand.pop(); // remove the player's own top card
    }
    target.hand.push(card); // land on TOP of the target's pile

    // Turn continues — the player may transfer another eligible card or draw again.
    // Reset the turn timer: a legit action hands the player the turn afresh, so the
    // countdown restarts (they shouldn't run out mid-turn for having acted).
    this.beginTurn();
    this.broadcastState();
    return null;
  }

  private thosoDraw(playerId: string): ErrorCode | null {
    if (this.phase !== 'TRANSFER') return 'WRONG_PHASE';
    if (this.currentTurnPlayerId() !== playerId) return 'NOT_YOUR_TURN';
    const seat = this.getSeat(playerId);
    if (!seat) return 'NOT_IN_ROOM';

    const piles = this.handsMap();
    const ownTop = topCard(seat.hand);
    // A legal transfer is "available" if the pending drawn card is transferable, or
    // the player's own pile top is transferable to some opponent.
    const transferAvailable =
      (this.drawnCard != null && isTransferable(this.drawnCard.rank, piles, playerId)) ||
      (ownTop != null && isTransferable(ownTop.rank, piles, playerId));

    if (transferAvailable) {
      // Missed-transfer penalty (automatic): each opponent gives this player a card.
      const received = this.applyPenalty(playerId);
      if (this.drawnCard) { seat.hand.push(this.drawnCard); this.drawnCard = null; } // un-transferred card stays
      this.setAnnouncement({
        title: `Penalty +${received.length}`, subtitle: `${seat.player.name} missed a transfer`,
        variant: 'stakesDown', icon: 'trendingDown',
      });
      this.showPenaltyReveal(playerId, received);
    } else if (this.drawnCard) {
      // No miss, but a pending drawn card that's no longer transferable → file it.
      seat.hand.push(this.drawnCard);
      this.drawnCard = null;
    }

    // Draw the next card from the central pile.
    if (this.deck.length === 0) { this.beginPlayingPhase(); return null; }
    const drawn = this.deck.pop()!;
    if (isTransferable(drawn.rank, this.handsMap(), playerId)) {
      // Transferable → keep it face-up and pending; the turn continues.
      this.drawnCard = drawn;
      this.beginTurn(); // reset the turn timer — the draw kept the turn alive
      this.broadcastState();
      return null;
    }
    // Not transferable → goes on top of the player's own pile, turn ends.
    seat.hand.push(drawn);
    this.drawnCard = null;
    this.endTransferTurn();
    return null;
  }

  // Each other seat gives the penalised player its first card (bottom of the pile).
  // Returns the cards the penalised player received (for the +N count and reveal).
  private applyPenalty(playerId: string): Card[] {
    const seat = this.getSeat(playerId);
    if (!seat) return [];
    const received: Card[] = [];
    for (const other of this.seats) {
      if (other.player.id === playerId) continue;
      if (other.hand.length > 0) {
        const c = other.hand.shift()!;
        seat.hand.push(c);
        received.push(c);
      }
    }
    return received;
  }

  private endTransferTurn(): void {
    this.drawnCard = null;
    if (this.deck.length === 0) { this.beginPlayingPhase(); return; }
    this.currentTurnSeatIndex = this.nextSeatIndex(this.currentTurnSeatIndex);
    this.beginTurn();
    this.broadcastState();
  }

  // ─── Phase 2 — Play (Shedding) ──────────────────────────────────────────────

  private beginPlayingPhase(): void {
    this.drawnCard = null;
    this.phase = 'PLAYING';
    this.ledSuit = null;
    this.currentTrick = [];
    // Rank any player who ended Phase 1 with an empty pile (already "out"), in seat order.
    this.seats.forEach(s => this.checkFinished(s));
    this.setAnnouncement({ title: 'Play Phase', subtitle: 'Shed your hand to win', variant: 'intro' });
    if (this.maybeEndGame()) return; // degenerate: ≤1 player holds cards

    // The Ace of Spades holder leads first AND must open with it (opening lead is owed).
    const asIdx = this.seats.findIndex(s => s.hand.some(c => c.rank === 'A' && c.suit === 'S'));
    const leaderIdx = (asIdx >= 0 && !this.isFinished(this.seats[asIdx].player.id))
      ? asIdx
      : this.firstActiveSeatIndex();
    this.openingLeadPending = asIdx >= 0; // only enforce A♠ if someone actually holds it
    if (this.openingLeadPending) {
      this.setAnnouncement({
        title: 'Play Phase',
        subtitle: `${this.seats[leaderIdx].player.name} must open with the Ace of Spades ♠A`,
        variant: 'intro',
      });
    }
    this.startPlayRound(leaderIdx);
  }

  private thosoPlay(playerId: string, cardId: string): ErrorCode | null {
    if (this.phase !== 'PLAYING') return 'WRONG_PHASE';
    if (this.roundResolving) return 'WRONG_PHASE'; // reject plays during the round-display hold
    if (this.currentTurnPlayerId() !== playerId) return 'NOT_YOUR_TURN';
    const seat = this.getSeat(playerId);
    if (!seat) return 'NOT_IN_ROOM';

    const idx = seat.hand.findIndex(c => c.id === cardId);
    if (idx === -1) return 'CARD_NOT_IN_HAND';
    const card = seat.hand[idx];
    const requireAceOfSpades = this.openingLeadPending && this.ledSuit === null;
    const legal = legalPlays(seat.hand, this.ledSuit, requireAceOfSpades);
    if (!legal.some(c => c.id === cardId)) return 'ILLEGAL_CARD';

    const thoso = isThoso(card, this.ledSuit, seat.hand);
    this.cancelTurnTimer();

    // 1. Leader — sets the led suit, then the round proceeds in seat order.
    if (this.ledSuit === null) {
      this.ledSuit = card.suit;
      this.openingLeadPending = false; // the opening A♠ has now been played
      seat.hand.splice(idx, 1);
      this.currentTrick.push({ playerId, card });
      this.checkFinished(seat);
      if (this.maybeEndGame()) return null;
      this.advancePlayingTurn();
      return null;
    }

    // 2. Thoso — an off-suit discard by a void player; ends the round at once.
    if (thoso) {
      seat.hand.splice(idx, 1); // the thoso card leaves the player…
      const pickerId = highestLedSuitPlayer(this.currentTrick, this.ledSuit);
      const picker = pickerId ? this.getSeat(pickerId) : undefined;
      if (picker) {
        for (const tc of this.currentTrick) picker.hand.push(tc.card);
        picker.hand.push(card); // …and lands, with the whole round, on the led-suit leader
        // The pile-winner may have emptied their hand earlier this round (marked finished),
        // but picking up the pile brings them back into the game — re-open their seat and
        // renumber the finishing order so there are no rank gaps. This must run before the
        // maybeEndGame() check below, which counts un-finished seats.
        if (this.isFinished(picker.player.id)) {
          const reopenId = picker.player.id;
          this.finishedRanks = this.finishedRanks
            .filter(r => r.playerId !== reopenId)
            .map((r, i) => ({ ...r, rank: i + 1 }));
        }
      }
      this.setAnnouncement({
        title: 'THOSO!', subtitle: `${seat.player.name} sweeps the pile`,
        variant: 'lastStand', icon: 'swords',
      });
      this.checkFinished(seat); // the thoso may have shed the player's last card
      if (this.maybeEndGame()) return null;
      this.currentTrick.push({ playerId, card }); // show the off-suit thoso card during the hold
      const leaderIdx = !this.isFinished(playerId)
        ? seat.player.seatIndex
        : this.nextActiveSeatIndex(seat.player.seatIndex);
      this.endRoundAndLead(leaderIdx);
      return null;
    }

    // 3. Follows suit — add to the round, advance in seat order.
    seat.hand.splice(idx, 1);
    this.currentTrick.push({ playerId, card });
    this.checkFinished(seat);
    if (this.maybeEndGame()) return null;
    this.advancePlayingTurn();
    return null;
  }

  private advancePlayingTurn(): void {
    // Round complete (no thoso): everyone active-at-round-start has played.
    if (this.currentTrick.length >= this.playersInRound) {
      // Discard the whole round permanently; the highest led-suit card holder leads next.
      const winnerId = this.ledSuit ? highestLedSuitPlayer(this.currentTrick, this.ledSuit) : null;
      const winnerSeat = winnerId ? this.getSeat(winnerId) : undefined;
      const from = winnerSeat ? winnerSeat.player.seatIndex : this.currentTurnSeatIndex;
      const leaderIdx = (winnerSeat && !this.isFinished(winnerId!))
        ? winnerSeat.player.seatIndex
        : this.nextActiveSeatIndex(from); // winner finished this round → next active leads
      this.endRoundAndLead(leaderIdx);
      return;
    }
    // Round continues.
    this.currentTurnSeatIndex = this.nextActiveSeatIndex(this.currentTurnSeatIndex);
    this.beginTurn();
    this.broadcastState();
  }

  private endRoundAndLead(leaderSeatIndex: number): void {
    // Hold the completed round on screen briefly (mirrors BidBaaziRoom.resolveTrick) so
    // players can see who played what. Keep currentTrick + ledSuit populated during the
    // hold; there's no live turn (turnExpiresAt null). Then clear + lead the next round.
    this.roundResolving = true;
    this.turnExpiresAt = null;
    this.cancelTurnTimer();
    this.broadcastState();
    this.roundHoldTimer = this.clearTimer(this.roundHoldTimer);
    this.roundHoldTimer = setTimeout(() => {
      this.roundHoldTimer = null;
      this.roundResolving = false;
      this.currentTrick = [];
      this.ledSuit = null;
      if (this.maybeEndGame()) return;
      this.startPlayRound(leaderSeatIndex);
    }, TRICK_DISPLAY_MS);
  }

  private startPlayRound(leaderSeatIndex: number): void {
    this.ledSuit = null;
    this.currentTrick = [];
    this.currentTurnSeatIndex = leaderSeatIndex;
    this.playersInRound = this.activeSeatCount();
    this.beginTurn();
    this.broadcastState();
  }

  // Record a player as finished the first time their hand empties (by playing out).
  private checkFinished(seat: Seat): void {
    if (seat.hand.length === 0 && !this.isFinished(seat.player.id)) {
      this.finishedRanks.push({ playerId: seat.player.id, rank: this.finishedRanks.length + 1 });
    }
  }

  // When only one (or zero) players still hold cards, the game is over: the sole
  // holder takes the last rank (loser). Returns true iff the game ended.
  private maybeEndGame(): boolean {
    const remaining = this.seats.filter(s => !this.isFinished(s.player.id));
    if (remaining.length <= 1) {
      if (remaining.length === 1) {
        this.finishedRanks.push({ playerId: remaining[0].player.id, rank: this.finishedRanks.length + 1 });
      }
      this.endGame();
      return true;
    }
    return false;
  }

  private endGame(): void {
    this.phase = 'GAME_OVER';
    this.cancelTurnTimer();
    this.turnExpiresAt = null;
    this.turnPausedRemainingMs = null;
    this.penaltyRevealTimer = this.clearTimer(this.penaltyRevealTimer);
    this.penaltyReveal = null;
    this.roundHoldTimer = this.clearTimer(this.roundHoldTimer);
    this.roundResolving = false;
    this.startGameOverTimer(); // set gameOverExpiresAt FIRST so state carries roomExpiresInMs
    this.broadcastState();
  }

  // ─── Turn timer ─────────────────────────────────────────────────────────────

  // Thoso turns all use the play timeout. BaseRoom.beginTurn applies it (and swaps in
  // NPC_AUTO_MOVE_MS for an offline seat).
  protected turnDurationMs(): number {
    return PLAY_TIMEOUT_MS;
  }

  protected autoAction(): void {
    if (this.phase === 'TRANSFER') {
      // Timeout → skip the turn (no auto-transfer, no penalty). Any pending drawn card
      // is filed onto the player's own pile so all 52 cards stay accounted for.
      const seat = this.seats[this.currentTurnSeatIndex];
      if (this.drawnCard && seat) seat.hand.push(this.drawnCard);
      this.drawnCard = null;
      // Liveness: a timeout still draws one card from the central pile onto the player's
      // pile so the deck always drains — otherwise an all-idle table would stall Phase 1
      // forever (the timer would re-fire endlessly without ever reaching Phase 2).
      if (seat && this.deck.length > 0) seat.hand.push(this.deck.pop()!);
      this.endTransferTurn();
      return;
    }
    if (this.phase === 'PLAYING') {
      const seat = this.seats[this.currentTurnSeatIndex];
      if (!seat || seat.hand.length === 0) return;
      let choice: Card;
      if (this.ledSuit === null) {
        choice = this.openingLeadPending
          ? (seat.hand.find(c => c.rank === 'A' && c.suit === 'S') ?? this.lowestCard(seat.hand))
          : this.lowestCard(seat.hand); // opening lead → A♠, else lowest card
      } else {
        const ledCards = seat.hand.filter(c => c.suit === this.ledSuit);
        // Follow with the lowest led-suit card, else auto-thoso the lowest off-suit card.
        choice = this.lowestCard(ledCards.length > 0 ? ledCards : seat.hand);
      }
      this.thosoPlay(seat.player.id, choice.id);
    }
  }

  // ─── Announcement banner ────────────────────────────────────────────────────

  // Show the penalised player their received cards privately for 5s, then clear.
  private showPenaltyReveal(playerId: string, cards: Card[]): void {
    if (cards.length === 0) return;
    this.penaltyReveal = { playerId, cards };
    this.penaltyRevealTimer = this.clearTimer(this.penaltyRevealTimer);
    this.penaltyRevealTimer = setTimeout(() => {
      this.penaltyReveal = null;
      this.penaltyRevealTimer = null;
      this.broadcastState();
    }, PENALTY_REVEAL_MS);
  }

  // Show a banner and auto-clear it after ANNOUNCE_MS (re-broadcasting on clear).
  private setAnnouncement(a: Announcement | null): void {
    this.announcement = a;
    this.announcementTimer = this.clearTimer(this.announcementTimer);
    if (a) {
      this.announcementTimer = setTimeout(() => {
        this.announcement = null;
        this.announcementTimer = null;
        this.broadcastState();
      }, ANNOUNCE_MS);
    }
  }

  // ─── State broadcast ────────────────────────────────────────────────────────

  private buildThosoState(forPlayerId: string): ThosoState {
    const seat = this.getSeat(forPlayerId);

    // Phase 1 visibility: every player's face-up pile TOP card is public. Only emitted
    // during TRANSFER — in PLAYING a seat's `hand` is its private playing hand, so
    // sending its top card would leak one hidden card of every opponent to all clients.
    const pileTops: Record<string, Card | null> = {};
    if (this.phase === 'TRANSFER') {
      for (const s of this.seats) pileTops[s.player.id] = topCard(s.hand);
    }

    // Phase 2: opponents' hand sizes (your own detail comes from yourHand).
    const handCounts: Record<string, number> = {};
    for (const s of this.seats) {
      if (s.player.id !== forPlayerId) handCounts[s.player.id] = s.hand.length;
    }

    const turnActive = this.phase === 'TRANSFER' || this.phase === 'PLAYING';
    return {
      game: 'thoso',
      phase: this.phase,
      roomId: this.id,
      players: this.seats.map(s => s.player),
      hostId: this.hostId ?? '',
      maxPlayers: this.maxPlayers,
      drawPileCount: this.deck.length,
      pileTops,
      drawnCard: this.drawnCard, // public face-up drawn card awaiting a transfer decision
      penaltyReveal: this.penaltyReveal && this.penaltyReveal.playerId === forPlayerId
        ? this.penaltyReveal.cards
        : null,
      handCounts,
      // Phase 1 keeps your pile face-down (only your top card is visible, via pileTops);
      // your full hand is revealed only in Phase 2 onward.
      yourHand: this.phase === 'TRANSFER' ? [] : (seat?.hand ?? []),
      currentTurn: this.currentTurnPlayerId() || null,
      ledSuit: this.ledSuit,
      mustLeadAceOfSpades: this.openingLeadPending && this.ledSuit === null,
      currentTrick: this.currentTrick,
      roundResolving: this.roundResolving,
      finishedRanks: this.finishedRanks,
      turnTimeoutMs: PLAY_TIMEOUT_MS,
      turnExpiresAt: turnActive ? this.turnExpiresAt : null,
      turnRemainingMs: turnActive
        ? (this.turnExpiresAt != null ? Math.max(0, this.turnExpiresAt - Date.now()) : this.turnPausedRemainingMs)
        : null,
      countdownMs: this.countdownEndsAt ? Math.max(0, this.countdownEndsAt - Date.now()) : null,
      roomExpiresInMs: this.gameOverExpiresAt ? Math.max(0, this.gameOverExpiresAt - Date.now()) : null,
      announcement: this.announcement,
    };
  }

  broadcastState(): void {
    this.forEachOpenSeat(seat => {
      sendMessage(seat.ws!, { type: 'thosoState', state: this.buildThosoState(seat.player.id) });
    });
  }

  sendState(ws: WebSocket, playerId: string): void {
    sendMessage(ws, { type: 'thosoState', state: this.buildThosoState(playerId) });
  }

  // Thoso carries all end-of-game info in the state itself (finishedRanks) — no
  // one-shot payloads to replay on reconnect.
  resendPhaseExtras(_ws: WebSocket): void { /* no-op */ }

  getPhase(): ThosoState['phase'] { return this.phase; }

  handleGameMessage(playerId: string, msg: ClientMessage): ErrorCode | null {
    switch (msg.type) {
      case 'thosoDraw':          return this.thosoDraw(playerId);
      case 'thosoTransfer':      return this.thosoTransfer(playerId, msg.cardId, msg.toPlayerId);
      case 'thosoPlay':          return this.thosoPlay(playerId, msg.cardId);
      case 'startGame':          return this.startGame(playerId);
      case 'restartGame':        return this.restartGame(playerId);
      case 'updateRoomSettings': return this.updateRoomSettings(playerId, msg.maxPlayers);
      default:                   return null; // not a message this game handles
    }
  }
}
