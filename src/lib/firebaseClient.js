import {getApps, initializeApp} from 'firebase/app';
import {getAuth} from 'firebase/auth';

// NEXT_PUBLIC_ values are built into the browser bundle. They identify the Firebase
// project and are not secrets; access is enforced by verifying ID tokens on our server.
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

export const firebaseConfigured = Object.values(config).every(Boolean);

export function getClientAuth() {
  if (!firebaseConfigured) return null;
  const app = getApps()[0] ?? initializeApp(config);
  return getAuth(app);
}
