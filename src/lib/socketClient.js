import {io} from 'socket.io-client';
import {getClientAuth} from './firebaseClient';

let socket = null;

// One shared connection per browser tab. `auth` is a function so every reconnect
// sends a fresh ID token (they expire after an hour).
export function getSocket() {
  if (!socket) {
    socket = io({
      autoConnect: false,
      auth: async (callback) => {
        const token = await getClientAuth()?.currentUser?.getIdToken();
        callback({token});
      }
    });
  }
  return socket;
}
