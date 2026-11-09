import {io} from 'socket.io-client';
import {getClientAuth} from './firebaseClient';

let socket = null;

// serverTime - Date.now(), in ms. Stays 0 until the first connect.
let clockOffset = 0;

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

    // The server sends its clock as soon as we connect. That alone is off by the one-way
    // latency, so follow up with a ping and assume the reply took half the round trip.
    socket.on('clock', ({serverTime}) => {
      clockOffset = serverTime - Date.now();
      const sentAt = Date.now();
      socket.emit('ping', (reply) => {
        const receivedAt = Date.now();
        clockOffset = reply.serverTime + (receivedAt - sentAt) / 2 - receivedAt;
      });
    });
  }
  return socket;
}

// Current server time in ms. Use this, not Date.now(), for auction countdowns.
export function serverNow() {
  return Date.now() + clockOffset;
}

export function getClockOffset() {
  return clockOffset;
}
