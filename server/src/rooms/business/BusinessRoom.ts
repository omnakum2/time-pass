import WebSocket from 'ws';
import {
  Announcement, ClientMessage, ErrorCode, BusinessState, TileOwnership,
  GLOBALS, PLAYER_COLOURS, GAMES,
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
    this.currentTurnSeatIndex = 0;
    this.phase = 'ROLLING';
    this.broadcastState();
  }

  // ─── Turn timer ───────────────────────────────────────────────────────────────

  // Business turns all use the play timeout. BaseRoom.beginTurn applies it (and swaps in
  // NPC_AUTO_MOVE_MS for an offline seat).
  protected turnDurationMs(): number {
    return PLAY_TIMEOUT_MS;
  }

  protected autoAction(): void {
    // Phase 2: on a timeout, auto-roll / auto-end the current player's turn.
    // No live turn timer runs in Phase 1 (no dice/movement yet), so this never fires.
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
      case 'businessRoll':       return null; // Phase 2
      case 'businessBuy':        return null; // Phase 2
      case 'businessEndTurn':    return null; // Phase 2
      default:                   return null; // not a message this game handles
    }
  }
}
