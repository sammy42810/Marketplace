// Imported by server.js, which runs unbundled: relative imports only, no "@/".
import {Server} from 'socket.io';
import {FirebaseConfigError, getAdminAuth} from './firebaseAdmin.js';
import {setIo, userRoom} from './realtime.js';
import {findOrCreateUser} from './users.js';

export function attachSockets(httpServer) {
  const io = new Server(httpServer);

  // Runs once per connection, before 'connection'. The client sends {token} in the handshake auth.
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== 'string' || token.length === 0) return next(new Error('unauthorized'));
    let decoded;
    try {
      decoded = await getAdminAuth().verifyIdToken(token);
    } catch (error) {
      if (error instanceof FirebaseConfigError) {
        console.error(error.message);
        return next(new Error('Sign-in is not configured on the server.'));
      }
      console.error('Socket auth failed:', error.message);
      return next(new Error('unauthorized'));
    }
    try {
      // Rooms use users._id, the id every other collection stores, so emitters need no lookup.
      const user = await findOrCreateUser(decoded);
      socket.data.uid = decoded.uid;
      socket.data.userId = user._id.toString();
      next();
    } catch (error) {
      console.error('Socket user lookup failed:', error.message);
      next(new Error('server_error'));
    }
  });

  io.on('connection', (socket) => {
    // Lets the server reach one user on every tab they have open.
    socket.join(userRoom(socket.data.userId));

    // The client turns this into an offset from its own clock, so auction countdowns use server time.
    socket.emit('clock', {serverTime: Date.now()});

    socket.on('ping', (ack) => {
      if (typeof ack === 'function') ack({serverTime: Date.now()});
    });
  });

  setIo(io);
  return io;
}
