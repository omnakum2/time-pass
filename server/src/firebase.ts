import type { UserAccount } from 'shared';

// Seed wallet granted to a brand-new account on first sign-in.
export const SEED_COINS = 1000, SEED_GEMS = 0;

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
    await ref.set(account);
    return account;
  }
}

// Cached process-wide singleton, built on first use.
let identity: Identity | null = null;
export function getIdentity(): Identity {
  if (!identity) identity = new FirebaseIdentity();
  return identity;
}
