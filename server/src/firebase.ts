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
}

// Cached process-wide singleton, built on first use.
let identity: Identity | null = null;
export function getIdentity(): Identity {
  if (!identity) identity = new FirebaseIdentity();
  return identity;
}
