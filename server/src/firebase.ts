import { createHash } from 'crypto';
import type { UserAccount, DailyReward, SpinPrize, LeaderboardEntry } from 'shared';
import {
  claimDaily as computeClaim, spinCost, drawSpin, coinsForGems, isValidGemAmount, LEADERBOARD_SIZE,
  FIRST_WIN_BONUS, winStreakBonusCoins, REFERRAL_REWARD, REFERRAL_CODE_LENGTH, normalizeReferralCode,
  AD_REWARD_COINS, AD_REWARDS_PER_DAY,
} from 'shared';

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
  // V3 Phase 6: `winStreak` = consecutive Coin Rush wins (bumped on a win, reset to 0 on a
  // non-win); `lastWinDate` = last IST day a first-win-of-day bonus was paid (dedupe key).
  stats?: { games?: number; wins?: number; jackpots?: number; winStreak?: number; lastWinDate?: string };
  // V3 Phase 6: referral invites. `code` is this user's own shareable code (deterministic
  // from uid); `referredBy` is set once when they apply someone else's code; `invitedCount`
  // counts players who applied THIS user's code.
  referral?: { code: string; referredBy?: string; invitedCount?: number };
  // V3 Phase 6: rewarded-ad top-up quota. `dayKey` is the IST day the count applies to;
  // `used` resets to 0 on a new day (see claimAdReward).
  ad?: { dayKey: string | null; used: number };
};

// ─── Referral code derivation (V3 Phase 6) ───────────────────────────────────
// Deterministic, stable, collision-resistant code from the uid: hash the uid and map the
// leading bytes onto a 36-char uppercase alphanumeric alphabet. Same uid → same code
// forever (so it can be regenerated lazily for pre-Phase-6 docs without a migration).
const REFERRAL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'; // [A-Z0-9], matches isValidReferralCodeShape
function referralCodeForUid(uid: string): string {
  const hash = createHash('sha256').update(uid).digest(); // 32 bytes
  let code = '';
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) code += REFERRAL_ALPHABET[hash[i] % REFERRAL_ALPHABET.length];
  return code;
}

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
  streakBonus: number; // V3 Phase 6: extra Coins from the Coin Rush win-streak (0 if no claim / no streak); already in `account`
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
  // in weekly/stats bookkeeping (games/wins/jackpots/winStreak) AND the first-win-of-day
  // bonus in the SAME per-user writes, so it stays a single write per player and runs
  // exactly once (open→settled). Returns per-winner first-win bonuses so room.ts can show them.
  settleGame(
    gameId: string,
    payouts: Record<string, number>,
    outcome: { weekKey: string; today: string; winnerUids: string[]; jackpotUids: string[] },
  ): Promise<{ accounts: Record<string, UserAccount>; firstWinBonus: Record<string, number> }>;
  // Return betAmount+fee to every reserved player and mark refunded (idempotent).
  refundGame(gameId: string): Promise<Record<string, UserAccount>>;
  // Sweep: refund any still-'open' reservation older than maxAgeMs (crash safety).
  refundStuckReservations(maxAgeMs: number): Promise<void>;
  // ─── Engagement track (V3 Phase 6) ──────────────────────────────────────────
  // Apply someone else's referral code (one-time; credits REFERRAL_REWARD to BOTH sides).
  applyReferral(uid: string, rawCode: string): Promise<{ account: UserAccount; status: { code: string; invitedCount: number; referredBy: boolean } }>;
  // The player's own referral standing (lazily mints + persists a code if they lack one).
  getReferral(uid: string): Promise<{ code: string; invitedCount: number; referredBy: boolean }>;
  // Claim a rewarded-ad top-up (daily-capped; throws AD_REWARD_DISABLED unless `enabled`).
  claimAdReward(uid: string, today: string, enabled: boolean): Promise<UserAccount>;
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
      // V3 Phase 6: seed a stable, deterministic referral code so it's shareable immediately.
      referral: { code: referralCodeForUid(uid), invitedCount: 0 },
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
      // V3 Phase 6: a real claim also pays the (capped) Coin Rush win-streak bonus on top.
      const streakBonus = claimed ? winStreakBonusCoins(data.stats?.winStreak ?? 0) : 0;
      if (claimed) {
        tx.update(ref, {
          coins: coins + reward.coins + streakBonus,
          gems: gems + reward.gems,
          'login.lastClaimDate': today,
          'login.streak': newStreak,
        });
      }
      return {
        claimed,
        streak: claimed ? newStreak : (login?.streak ?? 0),
        reward,
        streakBonus,
        account: {
          uid,
          displayName: data.displayName,
          coins: coins + (claimed ? reward.coins + streakBonus : 0),
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
    outcome: { weekKey: string; today: string; winnerUids: string[]; jackpotUids: string[] },
  ): Promise<{ accounts: Record<string, UserAccount>; firstWinBonus: Record<string, number> }> {
    const db = this.admin.firestore();
    const resRef = db.collection('reservations').doc(gameId);
    // Winners are distinct (one seat per uid); jackpots can repeat if a uid scooped in
    // several rounds, so count occurrences and bump stats.jackpots by that many.
    const winnerSet = new Set(outcome.winnerUids);
    const jackpotCounts: Record<string, number> = {};
    for (const u of outcome.jackpotUids) jackpotCounts[u] = (jackpotCounts[u] ?? 0) + 1;
    return db.runTransaction(async (tx: any) => {
      const resSnap = await tx.get(resRef);
      if (!resSnap.exists) return { accounts: {}, firstWinBonus: {} };
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
        return { accounts: out, firstWinBonus: {} };
      }

      const resUpdate: Record<string, any> = { status: 'settled' };
      const firstWinBonusOut: Record<string, number> = {};
      uids.forEach((u, i) => {
        const data = (userSnaps[i].exists ? userSnaps[i].data() : {}) as UserDoc;
        const coins = data.coins ?? 0;
        const won = payouts[u] ?? 0;
        const stats = data.stats ?? {};
        const isWinner = winnerSet.has(u);

        // One write per player, folding coins + stats/weekly + engagement bonuses together.
        const userUpdate: Record<string, any> = { 'stats.games': (stats.games ?? 0) + 1 };
        let bonus = 0; // first-win-of-day bonus (0 unless earned this settle)
        if (isWinner) {
          // Win-streak continues (+1). First Coin Rush win of the IST day earns FIRST_WIN_BONUS.
          userUpdate['stats.winStreak'] = (stats.winStreak ?? 0) + 1;
          if (stats.lastWinDate !== outcome.today) {
            bonus = FIRST_WIN_BONUS;
            userUpdate['stats.lastWinDate'] = outcome.today;
          }
          // Week rollover: reset weekly.wins to 1 when the stored week differs; else +1.
          const sameWeek = data.weekly?.key === outcome.weekKey;
          userUpdate['weekly.key'] = outcome.weekKey;
          userUpdate['weekly.wins'] = sameWeek ? (data.weekly?.wins ?? 0) + 1 : 1;
          userUpdate['stats.wins'] = (stats.wins ?? 0) + 1;
        } else {
          // A non-win breaks the streak (games still counted above).
          userUpdate['stats.winStreak'] = 0;
        }
        const newCoins = coins + won + bonus;
        if (won !== 0 || bonus !== 0) userUpdate.coins = newCoins;
        const jp = jackpotCounts[u] ?? 0;
        if (jp > 0) userUpdate['stats.jackpots'] = (stats.jackpots ?? 0) + jp;

        tx.update(userRefs[i], userUpdate);
        resUpdate[`players.${u}.payout`] = won;
        if (bonus > 0) firstWinBonusOut[u] = bonus;
        out[u] = walletOf(i, newCoins);
      });
      tx.update(resRef, resUpdate);
      return { accounts: out, firstWinBonus: firstWinBonusOut };
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

  // ─── Engagement track (V3 Phase 6) ──────────────────────────────────────────

  // Apply someone else's referral code. The referrer is resolved by an equality query
  // BEFORE the txn (Firestore txns can't run this query inline); the txn then reads both
  // docs, re-checks the invariants, and credits REFERRAL_REWARD to BOTH. One-time: once the
  // requester has `referral.referredBy`, a re-apply throws ALREADY_REFERRED.
  async applyReferral(
    uid: string,
    rawCode: string,
  ): Promise<{ account: UserAccount; status: { code: string; invitedCount: number; referredBy: boolean } }> {
    const db = this.admin.firestore();
    const code = normalizeReferralCode(rawCode);
    // Resolve the referrer by their stored code (outside the txn).
    const q = await db.collection('users').where('referral.code', '==', code).limit(1).get();
    if (q.empty || (q.docs?.length ?? 0) === 0) throw new Error('INVALID_REFERRAL');
    const referrerUid = q.docs[0].id as string;
    if (referrerUid === uid) throw new Error('SELF_REFERRAL');

    const requesterRef = db.collection('users').doc(uid);
    const referrerRef = db.collection('users').doc(referrerUid);
    return db.runTransaction(async (tx: any) => {
      const [reqSnap, refSnap] = await Promise.all([tx.get(requesterRef), tx.get(referrerRef)]);
      if (!refSnap.exists) throw new Error('INVALID_REFERRAL'); // referrer vanished between query and txn
      const reqData = (reqSnap.exists ? reqSnap.data() : {}) as UserDoc;
      const refData = refSnap.data() as UserDoc;
      if (reqData.referral?.referredBy) throw new Error('ALREADY_REFERRED'); // one-time only

      // Credit the referrer (+reward, +1 invitedCount).
      tx.update(referrerRef, {
        coins: (refData.coins ?? 0) + REFERRAL_REWARD,
        'referral.invitedCount': (refData.referral?.invitedCount ?? 0) + 1,
      });

      // Credit the requester (+reward) and stamp referredBy. Seed a full doc if they somehow
      // have none yet, so a brand-new account can still apply a code without crashing.
      const ownCode = reqData.referral?.code ?? referralCodeForUid(uid);
      const ownInvited = reqData.referral?.invitedCount ?? 0;
      let newReqCoins: number;
      let displayName: string;
      if (reqSnap.exists) {
        newReqCoins = (reqData.coins ?? 0) + REFERRAL_REWARD;
        displayName = reqData.displayName;
        tx.update(requesterRef, {
          coins: newReqCoins,
          'referral.code': ownCode,               // lazily persist a code if it was missing
          'referral.invitedCount': ownInvited,     // preserve existing count (or seed 0)
          'referral.referredBy': referrerUid,
        });
      } else {
        newReqCoins = SEED_COINS + REFERRAL_REWARD;
        displayName = '';
        tx.set(requesterRef, {
          uid, displayName, coins: newReqCoins, gems: SEED_GEMS,
          login: { lastClaimDate: null, streak: 0 },
          spin: { dayKey: null, usedToday: 0 },
          referral: { code: ownCode, invitedCount: 0, referredBy: referrerUid },
        });
      }

      return {
        account: { uid, displayName, coins: newReqCoins, gems: reqData.gems ?? SEED_GEMS },
        status: { code: ownCode, invitedCount: ownInvited, referredBy: true },
      };
    });
  }

  // The player's own referral standing. Lazily mints + persists a deterministic code for
  // pre-Phase-6 docs (no migration needed — the code is stable per uid).
  async getReferral(uid: string): Promise<{ code: string; invitedCount: number; referredBy: boolean }> {
    const db = this.admin.firestore();
    const ref = db.collection('users').doc(uid);
    const snap = await ref.get();
    const data = (snap.exists ? snap.data() : {}) as UserDoc;
    let code = data.referral?.code;
    if (!code) {
      code = referralCodeForUid(uid);
      // Persist only when the doc already exists; a missing doc gets the same code seeded on
      // its next getOrCreateUser, so the returned value is stable either way.
      if (snap.exists) {
        await ref.update({ 'referral.code': code, 'referral.invitedCount': data.referral?.invitedCount ?? 0 });
      }
    }
    return { code, invitedCount: data.referral?.invitedCount ?? 0, referredBy: !!data.referral?.referredBy };
  }

  // Claim a rewarded-ad top-up. Disabled unless `enabled` (server env flag). Daily-capped at
  // AD_REWARDS_PER_DAY per IST day; the count resets when the stored dayKey differs from today.
  async claimAdReward(uid: string, today: string, enabled: boolean): Promise<UserAccount> {
    if (!enabled) throw new Error('AD_REWARD_DISABLED');
    const db = this.admin.firestore();
    const ref = db.collection('users').doc(uid);
    return db.runTransaction(async (tx: any) => {
      const snap = await tx.get(ref);
      const data = (snap.exists ? snap.data() : {}) as UserDoc;
      const ad = data.ad;
      const used = ad && ad.dayKey === today ? ad.used : 0; // count only applies within the same IST day
      if (used >= AD_REWARDS_PER_DAY) throw new Error('AD_REWARD_LIMIT');
      if (snap.exists) {
        const newCoins = (data.coins ?? 0) + AD_REWARD_COINS;
        tx.update(ref, { coins: newCoins, 'ad.dayKey': today, 'ad.used': used + 1 });
        return { uid, displayName: data.displayName, coins: newCoins, gems: data.gems ?? 0 };
      }
      // Brand-new account: seed a full doc with the first ad claim recorded.
      const newCoins = SEED_COINS + AD_REWARD_COINS;
      tx.set(ref, {
        uid, displayName: '', coins: newCoins, gems: SEED_GEMS,
        login: { lastClaimDate: null, streak: 0 },
        spin: { dayKey: null, usedToday: 0 },
        referral: { code: referralCodeForUid(uid), invitedCount: 0 },
        ad: { dayKey: today, used: 1 },
      });
      return { uid, displayName: '', coins: newCoins, gems: SEED_GEMS };
    });
  }
}

// Cached process-wide singleton, built on first use.
let identity: Identity | null = null;
export function getIdentity(): Identity {
  if (!identity) identity = new FirebaseIdentity();
  return identity;
}

// Current date in IST (UTC+5:30) as 'YYYY-MM-DD' — the day boundary for streaks/spins/ads
// and the first-win-of-day bonus. Lives here (next to the identity that consumes it) so both
// room.ts and index.ts can import it without importing from index.ts (which would be circular).
export function istToday(): string {
  const d = new Date(Date.now() + 5.5 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
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
