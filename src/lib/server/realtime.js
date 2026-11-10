// Lets API routes reach the Socket.IO server that server.js starts. No dependencies, so it is
// safe to import from both the Next.js bundle and server.js (relative imports only, no "@/").
// The server lives on globalThis because Next.js and server.js load separate module copies.

export function setIo(io) {
  globalThis.marketplaceIo = io;
}

// Every tab a signed-in user has open joins this room. `userId` is the users collection _id.
export function userRoom(userId) {
  return `user:${userId}`;
}

// Fire-and-forget: does nothing if sockets aren't running (e.g. `next build`) or the user is offline.
export function emitToUser(userId, event, data) {
  globalThis.marketplaceIo?.to(userRoom(userId.toString())).emit(event, data);
}
