import WebSocket from 'ws';
import {
  Announcement, ClientMessage, ErrorCode, BusinessState, TileOwnership,
  GLOBALS, PLAYER_COLOURS, GAMES,
  rollDice, diceTotal, advance, tileAt,
} from 'shared';
import { PLAY_TIMEOUT_MS, ANNOUNCE_MS } from '../../constants';
import { sendMessage, clampPlayers } from '../../helpers';
import { BaseRoom } from '../BaseRoom';

// Business's player cap comes from the shared game registry — the single source of truth.
export const BUSINESS_MAX_PLAYERS = GAMES.find((g) => g.id === 'business')?.maxPlayers ?? 4;

/**
 * Server engine for **Business** — an Indian-Monopoly board game.
 *
 * PHASE 1 (scaffold): the game starts from the lobby, seats players with starting
 * cash + tokens parked at START, and renders as a live game (the board comes from
 * the client half). Host start / restart / capacity settings work. There is no
 * dice / movement / economy yet — the `businessRoll` / `businessBuy` /
 * `businessEndTurn` messages are accepted but no-op until a later phase.
 *
 * Room/lobby/connection/turn-timer plumbing mirrors {@link ThosoRoom} exactly.
 */
export class BusinessRoom extends BaseRoom {
  private phase: BusinessState['phase'] = 'LOBBY';

  // ─── Game state ─────────────────────────────────────────────────────────────
  private positions: Record<string, number> = {};   // playerId → tile index (0..35)
  private cash: Record<string, number> = {};         // playerId → money
  private colours: Record<string, string> = {};      // playerId → token/pip colour
  private dice: [number, number] | null = null;      // last roll (public)
  private ownership: Record<number, TileOwnership> = {}; // tile index → ownership (public)
  private bankrupt: string[] = [];                   // eliminated playerIds
  private skipNext = new Set<string>();              // parked by CLUB / REST HOUSE — miss next turn

  private announcement: Announcement | null = null;  // banner (phase intro / milestones)
  private announcementTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(id: string, maxPlayers = BUSINESS_MAX_PLAYERS) {
    super(id, maxPlayers); // BaseRoom clamps to [2,7]
  }

  // ─── Seat helpers ───────────────────────────────────────────────────────────

  // Live-turn phases — drives the shared reconnect/disconnect turn-timer resume.
  protected isTurnPhase(): boolean {
    return this.phase === 'ROLLING' || this.phase === 'BUYING';
  }

  // BaseRoom handles filter + reindex + host promotion; cancel a stale lobby
  // countdown if the room is no longer full.
  protected override removeSeat(playerId: string): void {
    super.removeSeat(playerId);
    if (this.countdownTimer && this.seats.length < this.maxPlayers) this.cancelCountdown();
  }

  // ─── Lobby ──────────────────────────────────────────────────────────────────

  startGame(requesterId: string): ErrorCode | null {
    if (requesterId !== this.hostId) return 'NOT_HOST';
    if (this.getPhase() !== 'LOBBY') return 'WRONG_PHASE';
    if (this.seats.length < 2) return 'NOT_ENOUGH_PLAYERS';
    this.cancelCountdown();
    this.startPlay();
    return null;
  }

  // Host-only lobby capacity edit (Business has no modes).
  updateRoomSettings(requesterId: string, maxPlayers?: number): ErrorCode | null {
    if (requesterId !== this.hostId) return 'NOT_HOST';
    if (this.phase !== 'LOBBY') return 'WRONG_PHASE';
    if (maxPlayers !== undefined) {
      if (!Number.isFinite(maxPlayers)) return 'INVALID_SETTINGS';
      const clamped = Math.min(clampPlayers(maxPlayers), BUSINESS_MAX_PLAYERS);
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

    this.positions = {};
    this.cash = {};
    this.colours = {};
    this.dice = null;
    this.ownership = {};
    this.bankrupt = [];
    this.skipNext.clear();
    this.currentTurnSeatIndex = 0;
    this.setAnnouncement(null);

    this.phase = 'LOBBY';
    this.broadcastState();
    return null;
  }

  protected beginGame(): void {
    if (this.phase !== 'LOBBY') return;
    if (this.seats.length < 2) { this.cancelCountdown(); return; }
    this.startPlay();
  }

  // Seed a fresh game: everyone starts with the configured cash, parked at START.
  private startPlay(): void {
    this.seats.forEach((s, i) => {
      this.cash[s.player.id] = GLOBALS.startingCash;
      this.positions[s.player.id] = 0;
      this.colours[s.player.id] = PLAYER_COLOURS[i % PLAYER_COLOURS.length];
    });
    this.dice = null;
    this.ownership = {};
    this.bankrupt = [];
    this.skipNext.clear();
    this.currentTurnSeatIndex = 0;
    this.phase = 'ROLLING';
    this.setAnnouncement({ variant: 'intro', title: 'Business begins — roll to move!' });
    this.beginTurn();
    this.broadcastState();
  }

  // ─── Turn timer ───────────────────────────────────────────────────────────────

  // Business turns all use the play timeout. BaseRoom.beginTurn applies it (and swaps in
  // NPC_AUTO_MOVE_MS for an offline seat).
  protected turnDurationMs(): number {
    return PLAY_TIMEOUT_MS;
  }

  // On a turn timeout (or an offline seat's short budget) auto-play the pending step:
  // roll while ROLLING, end the turn while in the post-roll BUYING phase.
  protected autoAction(): void {
    const pid = this.currentTurnPlayerId();
    if (!pid) return;
    if (this.phase === 'ROLLING') this.businessRoll(pid);
    else if (this.phase === 'BUYING') this.businessEndTurn(pid);
  }

  // ─── Movement & turns (Phase 2) ─────────────────────────────────────────────

  private nameOf(playerId: string): string {
    return this.seats.find(s => s.player.id === playerId)?.player.name ?? playerId;
  }

  // Income-Tax base: CITY properties (not stations/utilities) whose LAND this player owns.
  private cityPropsOwned(playerId: string): number {
    return Object.entries(this.ownership).filter(
      ([pos, o]) => o.land === playerId && tileAt(Number(pos)).type === 'property',
    ).length;
  }

  // Wealth-Tax base: every house + every hotel this player owns the buildings of.
  private buildingsOwned(playerId: string): number {
    return Object.values(this.ownership).reduce(
      (n, o) => n + (o.buildingOwner === playerId ? o.houses + (o.hotel ? 1 : 0) : 0),
      0,
    );
  }

  // Roll → move the token → auto-apply the landing effect (+ banner). Doubles roll
  // again (stay ROLLING); otherwise stop at the post-roll BUYING decision (Phase 3
  // adds buy/build there — for now the player just ends the turn).
  private businessRoll(playerId: string): ErrorCode | null {
    if (this.phase !== 'ROLLING') return 'WRONG_PHASE';
    if (playerId !== this.currentTurnPlayerId()) return 'NOT_YOUR_TURN';

    const roll = rollDice();
    this.dice = roll;
    const total = diceTotal(roll);
    const from = this.positions[playerId] ?? 0;
    const { pos, passedStart } = advance(from, total);
    this.positions[playerId] = pos;

    const effects: string[] = [];
    if (passedStart) {
      this.cash[playerId] = (this.cash[playerId] ?? 0) + GLOBALS.startBonus;
      effects.push(`+₹${GLOBALS.startBonus.toLocaleString('en-IN')} passing START`);
    }
    const landing = this.applyLanding(playerId, pos);
    if (landing) effects.push(landing);

    const doubles = roll[0] === roll[1];
    if (doubles) effects.push('Doubles — roll again!');
    this.setAnnouncement({
      variant: 'intro',
      title: `${this.nameOf(playerId)} rolled ${roll[0]} + ${roll[1]} → ${tileAt(pos).name}`,
      subtitle: effects.length ? effects.join(' · ') : undefined,
    });

    this.phase = doubles ? 'ROLLING' : 'BUYING';
    this.beginTurn();
    this.broadcastState();
    return null;
  }

  // Auto effect for the tile a player stopped on. Returns a short banner fragment (or
  // null). START bonus is handled by `passedStart`; property/station/utility (buy/rent)
  // arrive in Phase 3 and Chance/Chest cards in Phase 5 — no-ops here.
  private applyLanding(playerId: string, pos: number): string | null {
    const tile = tileAt(pos);
    switch (tile.type) {
      case 'corner':
        if (tile.corner === 'club' || tile.corner === 'restHouse') {
          this.skipNext.add(playerId);
          return `${tile.name} — misses next turn`;
        }
        if (tile.corner === 'jail') {
          this.cash[playerId] = (this.cash[playerId] ?? 0) - GLOBALS.jailFine;
          return `−₹${GLOBALS.jailFine.toLocaleString('en-IN')} fine at JAIL`;
        }
        return null; // START
      case 'tax': {
        const amount = tile.tax === 'income'
          ? GLOBALS.incomeTaxPerProperty * this.cityPropsOwned(playerId)
          : GLOBALS.wealthTaxPerBuilding * this.buildingsOwned(playerId);
        if (amount <= 0) return `${tile.name} — nothing owed`;
        this.cash[playerId] = (this.cash[playerId] ?? 0) - amount;
        return `−₹${amount.toLocaleString('en-IN')} ${tile.name}`;
      }
      default:
        return null; // property / station / utility → Phase 3; card → Phase 5
    }
  }

  // End the current turn and hand off to the next non-bankrupt seat, consuming (and
  // announcing) a CLUB/REST-HOUSE skip for anyone parked. Clears the dice for the new turn.
  private businessEndTurn(playerId: string): ErrorCode | null {
    if (this.phase !== 'BUYING') return 'WRONG_PHASE';
    if (playerId !== this.currentTurnPlayerId()) return 'NOT_YOUR_TURN';
    this.dice = null;
    this.advanceToNextPlayer();
    this.phase = 'ROLLING';
    this.beginTurn();
    this.broadcastState();
    return null;
  }

  private advanceToNextPlayer(): void {
    let idx = this.currentTurnSeatIndex;
    for (let guard = 0; guard < this.seats.length * 2 + 1; guard++) {
      idx = this.nextSeatIndex(idx);
      const pid = this.seats[idx]?.player.id;
      if (!pid || this.bankrupt.includes(pid)) continue;
      if (this.skipNext.has(pid)) {
        this.skipNext.delete(pid);
        this.setAnnouncement({ variant: 'intro', title: `${this.nameOf(pid)} misses this turn` });
        continue;
      }
      this.currentTurnSeatIndex = idx;
      return;
    }
    this.currentTurnSeatIndex = idx;
  }

  // ─── Announcement banner ────────────────────────────────────────────────────

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

  private buildBusinessState(forPlayerId: string): BusinessState {
    const turnActive = this.phase === 'ROLLING' || this.phase === 'BUYING';
    return {
      game: 'business',
      phase: this.phase,
      roomId: this.id,
      players: this.seats.map(s => s.player),
      hostId: this.hostId ?? '',
      maxPlayers: this.maxPlayers,
      // All Business fields are public in Phase 1 (no per-seat redaction yet).
      positions: this.positions,
      cash: this.cash,
      colours: this.colours,
      dice: this.dice,
      ownership: this.ownership,
      bankrupt: this.bankrupt,
      skipNext: [...this.skipNext],
      currentTurn: this.currentTurnPlayerId() || null,
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
      sendMessage(seat.ws!, { type: 'state', state: this.buildBusinessState(seat.player.id) });
    });
  }

  sendState(ws: WebSocket, playerId: string): void {
    sendMessage(ws, { type: 'state', state: this.buildBusinessState(playerId) });
  }

  // Business carries all its state in the state itself — no one-shot payloads to replay.
  resendPhaseExtras(_ws: WebSocket): void { /* no-op */ }

  getPhase(): BusinessState['phase'] { return this.phase; }

  handleGameMessage(playerId: string, msg: ClientMessage): ErrorCode | null {
    switch (msg.type) {
      case 'startGame':          return this.startGame(playerId);
      case 'restartGame':        return this.restartGame(playerId);
      case 'updateRoomSettings': return this.updateRoomSettings(playerId, msg.maxPlayers);
      case 'businessRoll':       return this.businessRoll(playerId);
      case 'businessBuy':        return null; // Phase 3 (land economy)
      case 'businessEndTurn':    return this.businessEndTurn(playerId);
      default:                   return null; // not a message this game handles
    }
  }
}
