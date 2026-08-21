import type { UserAccount, DailyReward, SpinPrize } from 'shared';
import { claimDaily as computeClaim, spinCost, drawSpin } from 'shared';

// Seed wallet granted to a brand-new account on first sign-in.
export const SEED_COINS = 1000, SEED_GEMS = 0;

// ─── Firestore document shape (internal — not the wire type) ─────────────────
// The persisted `users/{uid}` doc is the wallet (UserAccount) plus reward
// bookkeeping. `login`/`spin` are optional so pre-reward docs still read fine.
type UserDoc = UserAccount & {
  login?: { lastClaimDate: string | null; streak: number };
  spin?: { dayKey: string | null; usedToday: number };
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
  // ─── Coin Rush buy-in ledger (V3) — every method is an idempotent txn ───────
  // Debit one seat's buy-in (betAmount+fee) into reservations/{gameId}; the fee is
  // burned (never credited back except on a true refund). Idempotent per uid.
  debitBuyIn(gameId: string, uid: string, betAmount: number, fee: number): Promise<UserAccount>;
  // Credit each uid its payout coins and mark the reservation settled (idempotent).
  settleGame(gameId: string, payouts: Record<string, number>): Promise<Record<string, UserAccount>>;
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

  async settleGame(gameId: string, payouts: Record<string, number>): Promise<Record<string, UserAccount>> {
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

      // Only an 'open' reservation settles. Already 'settled' → idempotent no-op;
      // already 'refunded' → a concurrent abort won the race, so pay nothing on top
      // (the reservation's Firestore status is the authoritative single-winner lock).
      if (res.status !== 'open') {
        uids.forEach((_, i) => { out[uids[i]] = walletOf(i, (userSnaps[i].data()?.coins ?? 0)); });
        return out;
      }

      const resUpdate: Record<string, any> = { status: 'settled' };
      uids.forEach((u, i) => {
        const coins = userSnaps[i].data()?.coins ?? 0;
        const won = payouts[u] ?? 0;
        const newCoins = coins + won;
        if (won !== 0) tx.update(userRefs[i], { coins: newCoins });
        resUpdate[`players.${u}.payout`] = won;
        out[u] = walletOf(i, newCoins);
      });
      tx.update(resRef, resUpdate);
      return out;
    });
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
