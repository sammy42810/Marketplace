import {getClientAuth} from './firebaseClient';

// fetch() with the user's ID token. Throws with the server's `error` message on failure.
export async function authFetch(url, options = {}) {
  const headers = new Headers(options.headers);
  const currentUser = getClientAuth()?.currentUser;
  if (currentUser) headers.set('Authorization', `Bearer ${await currentUser.getIdToken()}`);
  if (typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {...options, headers});
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.error ?? `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return data;
}
