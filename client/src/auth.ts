// Google Sign-In via the Firebase Web SDK for Bid Club V3.
//
// ─── Firebase setup (client) ─────────────────────────────────────────────────
// Use the SAME Firebase project as the server (see server/src/firebase.ts).
//   1. Firebase console → Project settings → Your apps → add a Web app.
//   2. Copy its SDK config into client/.env as VITE_* vars (see client/.env.example).
//      Vite only exposes vars prefixed with VITE_ to the browser.
//   3. Authentication → Sign-in method → enable Google.
//   4. Authentication → Settings → Authorized domains → add your deployed domain.
//
// If the env vars are absent (e.g. local dev without a project), sign-in is
// skipped and the player stays anonymous (no account / no balance) — non-breaking.

import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, type Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

// A build is "auth-enabled" only when the Firebase project is configured.
const isConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
if (isConfigured && getApps().length === 0) {
  initializeApp(firebaseConfig as Record<string, string>);
}

/** True when a Firebase project is configured for this build. */
export function isAuthEnabled(): boolean {
  return isConfigured;
}

/**
 * Return a Google ID token for the signed-in user, prompting Google Sign-In if
 * they aren't signed in yet. Returns null when Firebase isn't configured
 * (anonymous play). The server verifies this token via firebase-admin.
 */
export async function getIdToken(): Promise<string | null> {
  if (!isConfigured) return null;
  const auth: Auth = getAuth();
  if (!auth.currentUser) {
    await signInWithPopup(auth, new GoogleAuthProvider());
  }
  return auth.currentUser ? auth.currentUser.getIdToken() : null;
}

/**
 * Like getIdToken but never prompts: returns a token only when a user is already
 * signed in, otherwise null. Use for silent status refreshes (no popup).
 */
export function getIdTokenIfSignedIn(): Promise<string | null> {
  if (!isConfigured) return Promise.resolve(null);
  const u = getAuth().currentUser;
  return u ? u.getIdToken() : Promise.resolve(null);
}

/** True when Firebase is configured AND a user is currently signed in. */
export function isSignedIn(): boolean {
  return isConfigured && getAuth().currentUser !== null;
}
