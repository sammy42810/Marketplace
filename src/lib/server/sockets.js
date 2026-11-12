// Imported by server.js, which runs unbundled: relative imports only, no "@/".
import { ObjectId } from "mongodb";
import { Server } from "socket.io";
import { HttpError } from "./auth.js";
import { chatRoom, findConversation, sendMessage } from "./chat.js";
import { FirebaseConfigError, getAdminAuth } from "./firebaseAdmin.js";
import { setIo, userRoom } from "./realtime.js";
import { findOrCreateUser } from "./users.js";

export function attachSockets(httpServer) {
  const io = new Server(httpServer);

  // Runs once per connection, before 'connection'. The client sends {token} in the handshake auth.
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== "string" || token.length === 0)
      return next(new Error("unauthorized"));
    let decoded;
    try {
      decoded = await getAdminAuth().verifyIdToken(token);
    } catch (error) {
      if (error instanceof FirebaseConfigError) {
        console.error(error.message);
        return next(new Error("Sign-in is not configured on the server."));
      }
      console.error("Socket auth failed:", error.message);
      return next(new Error("unauthorized"));
    }
    try {
      // Rooms use users._id, the id every other collection stores, so emitters need no lookup.
      const user = await findOrCreateUser(decoded);
      socket.data.uid = decoded.uid;
      socket.data.userId = user._id.toString();
      socket.data.emailVerified = decoded.email_verified === true;
      next();
    } catch (error) {
      console.error("Socket user lookup failed:", error.message);
      next(new Error("server_error"));
    }
  });

  io.on("connection", (socket) => {
    // Lets the server reach one user on every tab they have open.
    socket.join(userRoom(socket.data.userId));

    // The client turns this into an offset from its own clock, so auction countdowns use server time.
    socket.emit("clock", { serverTime: Date.now() });

    socket.on("ping", (ack) => {
      if (typeof ack === "function") ack({ serverTime: Date.now() });
    });

    // Let users join or leave auction rooms to receive live bid updates.
    socket.on("auction:join", ({ listingId } = {}, ack) => {
      if (typeof listingId !== "string" || !/^[0-9a-f]{24}$/i.test(listingId)) {
        if (typeof ack === "function") ack({ error: "Invalid listing ID." });
        return;
      }

      socket.join(`auction:${listingId.toLowerCase()}`);

      if (typeof ack === "function") ack({ ok: true });
    });

    socket.on("auction:leave", ({ listingId } = {}, ack) => {
      if (typeof listingId !== "string" || !/^[0-9a-f]{24}$/i.test(listingId)) {
        if (typeof ack === "function") ack({ error: "Invalid listing ID." });
        return;
      }

      socket.leave(`auction:${listingId.toLowerCase()}`);

      if (typeof ack === "function") ack({ ok: true });
    });

    socket.on("chat:join", async ({ conversationId } = {}, ack) => {
      await reply(ack, async () => {
        const conversation = await findConversation(conversationId, new ObjectId(socket.data.userId));
        socket.join(chatRoom(conversation._id.toString()));
        return { ok: true };
      });
    });

    socket.on("chat:leave", ({ conversationId } = {}, ack) => {
      if (typeof conversationId === "string" && /^[0-9a-f]{24}$/i.test(conversationId)) {
        socket.leave(chatRoom(conversationId.toLowerCase()));
      }
      if (typeof ack === "function") ack({ ok: true });
    });

    socket.on("chat:send", async ({ conversationId, body } = {}, ack) => {
      await reply(ack, async () => {
        if (!socket.data.emailVerified) {
          throw new HttpError(403, "Verify your email address first. Check your inbox for the link.");
        }
        const message = await sendMessage(conversationId, body, new ObjectId(socket.data.userId));
        return { message };
      });
    });
  });

  setIo(io);
  return io;
}

async function reply(ack, handler) {
  const respond = typeof ack === "function" ? ack : () => {};
  try {
    respond(await handler());
  } catch (error) {
    if (error instanceof HttpError) return respond({ error: error.message, status: error.status });
    console.error("Socket handler failed:", error);
    respond({ error: "Something went wrong.", status: 500 });
  }
}
