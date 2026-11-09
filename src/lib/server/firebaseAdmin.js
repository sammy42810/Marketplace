import {cert, getApps, initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';

export class FirebaseConfigError extends Error {}

function adminApp() {
  const existing = getApps();
  if (existing.length > 0) return existing[0];

  const {FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY} = process.env;
  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    throw new FirebaseConfigError(
      'Firebase Admin is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in .env.local.'
    );
  }

  return initializeApp({
    credential: cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      // .env files store the key on one line, with "\n" where the line breaks were.
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    })
  });
}

export function getAdminAuth() {
  return getAuth(adminApp());
}
