import type { UserAccount, DailyReward, SpinPrize, LeaderboardEntry } from 'shared';
import { claimDaily as computeClaim, spinCost, drawSpin, coinsForGems, isValidGemAmount, LEADERBOARD_SIZE } from 'shared';

// Seed wallet granted to a brand-new account on first sign-in.
export const SEED_COINS = 1000, SEED_GEMS = 0;

// ─── Firestore document shape (internal — not the wire type) ─────────────────
// The persisted `users/{uid}` doc is the wallet (UserAccount) plus reward
// bookkeeping. `login`/`spin` are optional so pre-reward docs still read fine.
type UserDoc = UserAccount & {
  login?: { lastClaimDate: string | null; streak: number };
  spin?: { dayKey: string | null; usedToday: number };
  // V3 Phase 5: weekly leaderboard driver + lifetime stats. `weekly.wins` resets to
  // 1 on the first win of a new ISO week (see settleGame); `stats` accumulates forever.
  weekly?: { key: string; wins: number };
  stats?: { games?: number; wins?: number; jackpots?: number };
};

// ─── Coin Rush reservation doc shape (internal) ──────────────────────────────
// One `reservations/{gameId}` doc per Coin Rush match: the real-Coin buy-in
// ledger. `betAmount`/`fee` are the per-seat figures; `players[uid]` records what
// each seat put in (and, once settled, its payout). `status` drives idempotency:
//   'open'     — buy-ins debited, game in progress (or the start is being attempted)
//   'settled'  — payouts credited; a re-settle is a no-op
//   'refunded' — buy-ins (betAmount+fee) returned; a re-refund is a no-op
type ReservationPlayer = { betAmount: number; fee: number; rank?: number; payout?: number };
type ReservationDoc = {
  createdAt: number;
  mode: string;
  betAmount: number;
  fee: number;
  status: 'open' | 'settled' | 'refunded';
  players: Record<string, ReservationPlayer>;
};

// ─── Weekly leaderboard cache (module-level) ─────────────────────────────────
// Cached top rows per weekKey for ~60s. Rows carry an internal `uid` (never sent to
// clients) so each request can stamp `isYou` / resolve `you` without a fresh read.
type LeaderboardRow = LeaderboardEntry & { uid: string };
const LEADERBOARD_CACHE_TTL_MS = 60_000;
const leaderboardCache = new Map<string, { at: number; rows: LeaderboardRow[] }>();
function getCachedLeaderboardRows(weekKey: string): LeaderboardRow[] | null {
  const c = leaderboardCache.get(weekKey);
  return c && Date.now() - c.at < LEADERBOARD_CACHE_TTL_MS ? c.rows : null;
}

// Return shapes for the reward operations (shared by the interface + class).
export interface RewardsStatus {
  canClaimDaily: boolean;
  streak: number;
  spinsUsedToday: number;
  nextSpinCost: number | null;
}
export interface DailyClaimResult {
  claimed: boolean;
  streak: number;
  reward: DailyReward;
  account: UserAccount;
}
export interface SpinResult {
  prize: SpinPrize;
  segmentIndex: number;
  cost: number;
  usedToday: number;
  nextCost: number | null;
  account: UserAccount;
}

/*
 * ─── Firebase setup (one-time) ───────────────────────────────────────────────
 * 1. Create a project:      https://console.firebase.google.com → Add project.
 * 2. Enable Google sign-in: Authentication → Sign-in method → Google → Enable.
 * 3. Enable Firestore:      Firestore Database → Create database (production
 *                           mode; region asia-south1 for India).
 * 4. Service-account key:    Project settings → Service accounts →
 *                           "Generate new private key" → download the JSON.
 * 5. Set these env vars on the server (e.g. Render → Environment), taken from
 *    that JSON — see server/.env.example. NEVER commit the private key:
 *        FIREBASE_PROJECT_ID    = <project_id>
 *        FIREBASE_CLIENT_EMAIL  = <client_email>
 *        FIREBASE_PRIVATE_KEY   = <private_key>   (keep the literal \n escapes)
 * 6. Add your deployed domain under Authentication → Settings → Authorized
 *    domains so Google sign-in works in production.
 *
 * `firebase-admin` is kept `--external` in the esbuild bundle and required
 * lazily below, so the server type-checks and bundles without it installed.
 */

export interface Identity {
  verifyIdToken(token: string): Promise<{ uid: string; name: string } | null>;
  getOrCreateUser(uid: string, name: string): Promise<UserAccount>;
  // ─── Reward protocol (V3) — `today` is a 'YYYY-MM-DD' IST date string ───────
  getRewardsStatus(uid: string, today: string): Promise<RewardsStatus>;
  claimDaily(uid: string, today: string): Promise<DailyClaimResult>;
  spin(uid: string, today: string, rand: number): Promise<SpinResult>;
  // ─── Gems + weekly leaderboard (V3 Phase 5) ─────────────────────────────────
  // One-way conversion Gems → Coins in a single idempotent-per-call txn (amount-guarded).
  convertGems(uid: string, gems: number): Promise<UserAccount>;
  // Weekly leaderboard for `weekKey` (top LEADERBOARD_SIZE by wins→coins). `you` is the
  // requester's own row (even outside the top set); null when anonymous / no wins this week.
  getLeaderboard(weekKey: string, requesterUid: string | null): Promise<{ week: string; entries: LeaderboardEntry[]; you: LeaderboardEntry | null }>;
  // ─── Coin Rush buy-in ledger (V3) — every method is an idempotent txn ───────
  // Debit one seat's buy-in (betAmount+fee) into reservations/{gameId}; the fee is
  // burned (never credited back except on a true refund). Idempotent per uid.
  debitBuyIn(gameId: string, uid: string, betAmount: number, fee: number): Promise<UserAccount>;
  // Credit each uid its payout coins and mark the reservation settled (idempotent). Folds
  // in weekly/stats bookkeeping (games/wins/jackpots) in the SAME per-user writes, so it
  // stays a single write per player and runs exactly once (open→settled).
  settleGame(
    gameId: string,
    payouts: Record<string, number>,
    outcome: { weekKey: string; winnerUids: string[]; jackpotUids: string[] },
  ): Promise<Record<string, UserAccount>>;
  // Return betAmount+fee to every reserved player and mark refunded (idempotent).
  refundGame(gameId: string): Promise<Record<string, UserAccount>>;
  // Sweep: refund any still-'open' reservation older than maxAgeMs (crash safety).
  refundStuckReservations(maxAgeMs: number): Promise<void>;
}

/**
 * Firebase-backed identity: verifies Google ID tokens and stores accounts in
 * Firestore `users/{uid}`. Constructed only on first authenticated request;
 * throws a clear error if the Firebase env vars are missing.
 */
class FirebaseIdentity implements Identity {
  private readonly admin: any;

  constructor() {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    // Env vars store the key with literal "\n"; convert back to real newlines.
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        'Firebase is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and ' +
        'FIREBASE_PRIVATE_KEY (see server/.env.example and the setup notes in firebase.ts).'
      );
    }
    // Lazy require so a missing `firebase-admin` never breaks the build/type-check.
    const admin = require('firebase-admin'); // eslint-disable-line @typescript-eslint/no-var-requires
    if (!admin.apps || admin.apps.length === 0) {
      admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
    }
    this.admin = admin;
  }

  async verifyIdToken(token: string): Promise<{ uid: string; name: string } | null> {
    try {
      const decoded = await this.admin.auth().verifyIdToken(token);
      return { uid: decoded.uid, name: decoded.name ?? decoded.displayName ?? '' };
    } catch {
      return null; // invalid / expired token → treat as unauthenticated
    }
  }

  async getOrCreateUser(uid: string, name: string): Promise<UserAccount> {
    const db = this.admin.firestore();
    const ref = db.collection('users').doc(uid);
    const snap = await ref.get();
    if (snap.exists) return snap.data() as UserAccount;
    const account: UserAccount = { uid, displayName: name, coins: SEED_COINS, gems: SEED_GEMS };
    // Seed reward bookkeeping alongside the wallet, but return only the wallet subset.
    const doc: UserDoc = {
      ...account,
      login: { lastClaimDate: null, streak: 0 },
      spin: { dayKey: null, usedToday: 0 },
    };
    await ref.set(doc);
    return account;
  }

  async getRewardsStatus(uid: string, today: string): Promise<RewardsStatus> {
    const db = this.admin.firestore();
    const snap = await db.collection('users').doc(uid).get();
    const data = (snap.exists ? snap.data() : {}) as UserDoc;
    const spin = data.spin;
    const spinsUsedToday = spin && spin.dayKey === today ? spin.usedToday : 0;
    return {
      canClaimDaily: (data.login?.lastClaimDate ?? null) !== today,
      streak: data.login?.streak ?? 0,
      spinsUsedToday,
      nextSpinCost: spinCost(spinsUsedToday),
    };
  }

  async claimDaily(uid: string, today: string): Promise<DailyClaimResult> {
    const db = this.admin.firestore();
    const ref = db.collection('users').doc(uid);
    return db.runTransaction(async (tx: any) => {
      const snap = await tx.get(ref);
      const data = (snap.exists ? snap.data() : {}) as UserDoc;
      const coins = data.coins ?? 0;
      const gems = data.gems ?? 0;
      const login = data.login;
      const { claimed, newStreak, reward } = computeClaim(login?.lastClaimDate ?? null, login?.streak ?? 0, today);
      if (claimed) {
        tx.update(ref, {
          coins: coins + reward.coins,
          gems: gems + reward.gems,
          'login.lastClaimDate': today,
          'login.streak': newStreak,
        });
      }
      return {
        claimed,
        streak: claimed ? newStreak : (login?.streak ?? 0),
        reward,
        account: {
          uid,
          displayName: data.displayName,
          coins: coins + (claimed ? reward.coins : 0),
          gems: gems + (claimed ? reward.gems : 0),
        },
      };
    });
  }

  async spin(uid: string, today: string, rand: number): Promise<SpinResult> {
    const db = this.admin.firestore();
    const ref = db.collection('users').doc(uid);
    return db.runTransaction(async (tx: any) => {
      const snap = await tx.get(ref);
      const data = (snap.exists ? snap.data() : {}) as UserDoc;
      const coins = data.coins ?? 0;
      const gems = data.gems ?? 0;
      const spinState = data.spin;
      const used = spinState && spinState.dayKey === today ? spinState.usedToday : 0;
      const cost = spinCost(used);
      if (cost === null) throw new Error('NO_SPINS_LEFT');
      if (cost > 0 && coins < cost) throw new Error('INSUFFICIENT_COINS');
      const { prize, index } = drawSpin(rand);
      const newCoins = coins - cost + prize.coins;
      const newGems = gems + prize.gems;
      tx.update(ref, {
        coins: newCoins,
        gems: newGems,
        'spin.dayKey': today,
        'spin.usedToday': used + 1,
      });
      return {
        prize,
        segmentIndex: index,
        cost,
        usedToday: used + 1,
        nextCost: spinCost(used + 1),
        account: { uid, displayName: data.displayName, coins: newCoins, gems: newGems },
      };
    });
  }

  // ─── Coin Rush buy-in ledger ────────────────────────────────────────────────

  async debitBuyIn(gameId: string, uid: string, betAmount: number, fee: number): Promise<UserAccount> {
    const db = this.admin.firestore();
    const resRef = db.collection('reservations').doc(gameId);
    const userRef = db.collection('users').doc(uid);
    return db.runTransaction(async (tx: any) => {
      // Reads before writes (Firestore txn rule).
      const resSnap = await tx.get(resRef);
      const userSnap = await tx.get(userRef);
      const res = (resSnap.exists ? resSnap.data() : null) as ReservationDoc | null;
      const data = (userSnap.exists ? userSnap.data() : {}) as UserDoc;
      const wallet = (coins: number): UserAccount => ({ uid, displayName: data.displayName, coins, gems: data.gems ?? 0 });

      // Idempotent: this seat already bought into this game → no double-debit.
      if (res && res.players && res.players[uid]) return wallet(data.coins ?? 0);

      const coins = data.coins ?? 0;
      const cost = betAmount + fee;
      if (coins < cost) throw new Error('INSUFFICIENT_BALANCE');
      const newCoins = coins - cost;
      tx.update(userRef, { coins: newCoins });

      const player: ReservationPlayer = { betAmount, fee };
      if (res) {
        tx.update(resRef, { [`players.${uid}`]: player });
      } else {
        const doc: ReservationDoc = {
          createdAt: Date.now(),
          mode: 'coinRush',
          betAmount,
          fee,
          status: 'open',
          players: { [uid]: player },
        };
        tx.set(resRef, doc);
      }
      return wallet(newCoins);
    });
  }

  async settleGame(
    gameId: string,
    payouts: Record<string, number>,
    outcome: { weekKey: string; winnerUids: string[]; jackpotUids: string[] },
  ): Promise<Record<string, UserAccount>> {
    const db = this.admin.firestore();
    const resRef = db.collection('reservations').doc(gameId);
    // Winners are distinct (one seat per uid); jackpots can repeat if a uid scooped in
    // several rounds, so count occurrences and bump stats.jackpots by that many.
    const winnerSet = new Set(outcome.winnerUids);
    const jackpotCounts: Record<string, number> = {};
    for (const u of outcome.jackpotUids) jackpotCounts[u] = (jackpotCounts[u] ?? 0) + 1;
    return db.runTransaction(async (tx: any) => {
      const resSnap = await tx.get(resRef);
      if (!resSnap.exists) return {};
      const res = resSnap.data() as ReservationDoc;
      const uids = Object.keys(res.players ?? {});
      const userRefs = uids.map(u => db.collection('users').doc(u));
      const userSnaps = await Promise.all(userRefs.map((ref: any) => tx.get(ref)));

      const out: Record<string, UserAccount> = {};
      const walletOf = (i: number, coins: number): UserAccount => {
        const d = (userSnaps[i].exists ? userSnaps[i].data() : {}) as UserDoc;
        return { uid: uids[i], displayName: d.displayName, coins, gems: d.gems ?? 0 };
      };

      // Only an 'open' reservation settles. Already 'settled' → idempotent no-op;
      // already 'refunded' → a concurrent abort won the race, so pay nothing on top
      // (the reservation's Firestore status is the authoritative single-winner lock).
      // The status guard also makes the weekly/stats bumps below fire exactly once.
      if (res.status !== 'open') {
        uids.forEach((_, i) => { out[uids[i]] = walletOf(i, (userSnaps[i].data()?.coins ?? 0)); });
        return out;
      }

      const resUpdate: Record<string, any> = { status: 'settled' };
      uids.forEach((u, i) => {
        const data = (userSnaps[i].exists ? userSnaps[i].data() : {}) as UserDoc;
        const coins = data.coins ?? 0;
        const won = payouts[u] ?? 0;
        const newCoins = coins + won;

        // One write per player, folding coins + stats/weekly together (no extra game write).
        const stats = data.stats ?? {};
        const userUpdate: Record<string, any> = { 'stats.games': (stats.games ?? 0) + 1 };
        if (won !== 0) userUpdate.coins = newCoins;
        if (winnerSet.has(u)) {
          // Week rollover: reset weekly.wins to 1 when the stored week differs; else +1.
          const sameWeek = data.weekly?.key === outcome.weekKey;
          userUpdate['weekly.key'] = outcome.weekKey;
          userUpdate['weekly.wins'] = sameWeek ? (data.weekly?.wins ?? 0) + 1 : 1;
          userUpdate['stats.wins'] = (stats.wins ?? 0) + 1;
        }
        const jp = jackpotCounts[u] ?? 0;
        if (jp > 0) userUpdate['stats.jackpots'] = (stats.jackpots ?? 0) + jp;

        tx.update(userRefs[i], userUpdate);
        resUpdate[`players.${u}.payout`] = won;
        out[u] = walletOf(i, newCoins);
      });
      tx.update(resRef, resUpdate);
      return out;
    });
  }

  // ─── Gems → Coins conversion (one-way; V3 Phase 5) ──────────────────────────
  async convertGems(uid: string, gems: number): Promise<UserAccount> {
    const db = this.admin.firestore();
    const ref = db.collection('users').doc(uid);
    return db.runTransaction(async (tx: any) => {
      const snap = await tx.get(ref);
      const data = (snap.exists ? snap.data() : {}) as UserDoc;
      const currentGems = data.gems ?? 0;
      if (!isValidGemAmount(gems, currentGems)) {
        // Distinguish "not enough gems" (a well-formed but over-balance ask) from a
        // malformed amount, so the client can show the right message.
        throw new Error(
          Number.isInteger(gems) && gems >= 1 && gems > currentGems ? 'INSUFFICIENT_GEMS' : 'INVALID_AMOUNT',
        );
      }
      const newGems = currentGems - gems;
      const newCoins = (data.coins ?? 0) + coinsForGems(gems);
      tx.update(ref, { gems: newGems, coins: newCoins });
      return { uid, displayName: data.displayName, coins: newCoins, gems: newGems };
    });
  }

  // ─── Weekly leaderboard (V3 Phase 5) ────────────────────────────────────────
  async getLeaderboard(
    weekKey: string,
    requesterUid: string | null,
  ): Promise<{ week: string; entries: LeaderboardEntry[]; you: LeaderboardEntry | null }> {
    const db = this.admin.firestore();

    // Top rows are cached per-week (~60s): the leaderboard is the main Firestore read
    // consumer, so we keep it cheap. Cached rows carry an internal uid for `isYou`/`you`.
    let rows = getCachedLeaderboardRows(weekKey);
    if (!rows) {
      rows = await this.computeLeaderboardRows(db, weekKey);
      leaderboardCache.set(weekKey, { at: Date.now(), rows });
    }

    // Per-request projection: stamp `isYou`, drop the internal uid.
    const entries: LeaderboardEntry[] = rows.map(r => ({
      rank: r.rank, displayName: r.displayName, wins: r.wins, coins: r.coins,
      isYou: requesterUid != null && r.uid === requesterUid,
    }));

    // `you`: reuse the top-set row if present; otherwise read the requester's doc.
    let you: LeaderboardEntry | null = null;
    if (requesterUid != null) {
      const mine = rows.find(r => r.uid === requesterUid);
      you = mine
        ? { rank: mine.rank, displayName: mine.displayName, wins: mine.wins, coins: mine.coins, isYou: true }
        : await this.computeYouRow(db, weekKey, requesterUid);
    }

    return { week: weekKey, entries, you };
  }

  // Read + rank the week's top rows (resilient to a missing composite index).
  private async computeLeaderboardRows(db: any, weekKey: string): Promise<LeaderboardRow[]> {
    let docs: any[];
    try {
      const snap = await db.collection('users')
        .where('weekly.key', '==', weekKey)
        .orderBy('weekly.wins', 'desc')
        .limit(LEADERBOARD_SIZE)
        .get();
      docs = snap.docs ?? [];
    } catch {
      // Missing composite index → fall back to the equality-only query, sort in memory
      // (same resilience pattern as refundStuckReservations).
      const snap = await db.collection('users').where('weekly.key', '==', weekKey).get();
      docs = snap.docs ?? [];
    }
    const ranked = docs.map((d: any) => {
      const data = d.data() as UserDoc;
      return {
        uid: (data.uid ?? d.id) as string,
        displayName: data.displayName ?? '',
        wins: data.weekly?.wins ?? 0,
        coins: data.coins ?? 0,
      };
    });
    // Wins DESC, then coins DESC (the coins tiebreak isn't in the Firestore orderBy).
    ranked.sort((a: any, b: any) => (b.wins - a.wins) || (b.coins - a.coins));
    return ranked.slice(0, LEADERBOARD_SIZE).map((r: any, i: number): LeaderboardRow => ({
      uid: r.uid, rank: i + 1, displayName: r.displayName, wins: r.wins, coins: r.coins, isYou: false,
    }));
  }

  // Build the requester's own row when they're outside the top set. Rank via a count()
  // aggregation of everyone ahead this week (+1); rank 0 if the aggregation is unavailable.
  private async computeYouRow(db: any, weekKey: string, uid: string): Promise<LeaderboardEntry | null> {
    const snap = await db.collection('users').doc(uid).get();
    if (!snap.exists) return null;
    const data = snap.data() as UserDoc;
    if (data.weekly?.key !== weekKey) return null; // no wins this week → not on the board
    const wins = data.weekly?.wins ?? 0;
    const coins = data.coins ?? 0;
    let rank = 0; // 0 = "rank unknown" sentinel (see fallback below)
    try {
      const agg = await db.collection('users')
        .where('weekly.key', '==', weekKey)
        .where('weekly.wins', '>', wins)
        .count()
        .get();
      const ahead = agg.data().count;
      if (typeof ahead === 'number') rank = ahead + 1;
    } catch {
      rank = 0; // count aggregation / index unavailable → best-effort unknown rank
    }
    return { rank, displayName: data.displayName ?? '', wins, coins, isYou: true };
  }

  async refundGame(gameId: string): Promise<Record<string, UserAccount>> {
    const db = this.admin.firestore();
    const resRef = db.collection('reservations').doc(gameId);
    return db.runTransaction(async (tx: any) => {
      const resSnap = await tx.get(resRef);
      if (!resSnap.exists) return {};
      const res = resSnap.data() as ReservationDoc;
      const uids = Object.keys(res.players ?? {});
      const userRefs = uids.map(u => db.collection('users').doc(u));
      const userSnaps = await Promise.all(userRefs.map((ref: any) => tx.get(ref)));

      const out: Record<string, UserAccount> = {};
      const walletOf = (i: number, coins: number): UserAccount => {
        const d = (userSnaps[i].exists ? userSnaps[i].data() : {}) as UserDoc;
        return { uid: uids[i], displayName: d.displayName, coins, gems: d.gems ?? 0 };
      };

      // Idempotent: only an 'open' reservation can be refunded.
      if (res.status !== 'open') {
        uids.forEach((_, i) => { out[uids[i]] = walletOf(i, (userSnaps[i].data()?.coins ?? 0)); });
        return out;
      }

      uids.forEach((u, i) => {
        const coins = userSnaps[i].data()?.coins ?? 0;
        const p = res.players[u];
        const back = (p.betAmount ?? 0) + (p.fee ?? 0); // betAmount + fee returned in full
        const newCoins = coins + back;
        tx.update(userRefs[i], { coins: newCoins });
        out[u] = walletOf(i, newCoins);
      });
      tx.update(resRef, { status: 'refunded' });
      return out;
    });
  }

  async refundStuckReservations(maxAgeMs: number): Promise<void> {
    const db = this.admin.firestore();
    const cutoff = Date.now() - maxAgeMs;
    let snap: any;
    try {
      snap = await db.collection('reservations')
        .where('status', '==', 'open')
        .where('createdAt', '<', cutoff)
        .get();
    } catch {
      // Missing composite index → fall back to a status-only query, filter client-side.
      snap = await db.collection('reservations').where('status', '==', 'open').get();
    }
    const stuck = (snap.docs ?? []).filter((d: any) => (d.data().createdAt ?? 0) < cutoff);
    for (const d of stuck) {
      try { await this.refundGame(d.id); } catch { /* best-effort; the next sweep retries */ }
    }
  }
}

// Cached process-wide singleton, built on first use.
let identity: Identity | null = null;
export function getIdentity(): Identity {
  if (!identity) identity = new FirebaseIdentity();
  return identity;
}

// Current IST (UTC+5:30) ISO-8601 week key 'YYYY-Www' (zero-padded week). ISO weeks
// start Monday; week 1 is the week containing the year's first Thursday (i.e. Jan 4).
// Lives here (next to the identity that consumes it) so both room.ts and index.ts can
// import it without importing from index.ts (which would be circular). Mirrors istToday's
// shift-then-read-UTC-fields trick for the IST offset.
export function istWeekKey(): string {
  const ist = new Date(Date.now() + 5.5 * 3600 * 1000);
  // Work on a UTC-midnight copy of the IST calendar date.
  const d = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()));
  // ISO weekday Mon=0 … Sun=6; step to this week's Thursday (which fixes the ISO year).
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const isoYear = d.getUTCFullYear();
  // Thursday of ISO week 1 is the Thursday in the week containing Jan 4.
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  firstThursday.setUTCDate(firstThursday.getUTCDate() - ((firstThursday.getUTCDay() + 6) % 7) + 3);
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}
