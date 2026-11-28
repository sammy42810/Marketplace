// Imported by server.js, which runs unbundled: relative imports only, no "@/".
import { ObjectId } from "mongodb";
import { Server } from "socket.io";
import { HttpError } from "./auth.js";
import { chatRoom, findConversation, relayTyping, sendMessage } from "./chat.js";
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

    // A listener that throws is an uncaught exception, which stops the whole server. So every
    // event goes through here: the payload is always a plain object, and errors become replies.
    const on = (event, handler) =>
      socket.on(event, async (...args) => {
        const ack = typeof args.at(-1) === "function" ? args.pop() : undefined;
        await reply(ack, () => handler(fields(args[0])));
      });

    socket.on("ping", (ack) => {
      if (typeof ack === "function") ack({ serverTime: Date.now() });
    });

    // Let users join or leave auction rooms to receive live bid updates.
    on("auction:join", ({ listingId }) => {
      socket.join(`auction:${listingIdOr400(listingId)}`);
      return { ok: true };
    });

    on("auction:leave", ({ listingId }) => {
      socket.leave(`auction:${listingIdOr400(listingId)}`);
      return { ok: true };
    });

    on("chat:join", async ({ conversationId }) => {
      const conversation = await findConversation(conversationId, new ObjectId(socket.data.userId));
      socket.join(chatRoom(conversation._id.toString()));
      return { ok: true };
    });

    on("chat:leave", ({ conversationId }) => {
      if (typeof conversationId === "string" && OBJECT_ID.test(conversationId)) {
        socket.leave(chatRoom(conversationId.toLowerCase()));
      }
      return { ok: true };
    });

    on("chat:send", async ({ conversationId, body }) => {
      if (!socket.data.emailVerified) {
        throw new HttpError(403, "Verify your email address first. Check your inbox for the link.");
      }
      const message = await sendMessage(conversationId, body, new ObjectId(socket.data.userId));
      return { message };
    });

    on("chat:typing", (payload) => relayTyping(socket, payload));
  });

  setIo(io);
  return io;
}

const OBJECT_ID = /^[0-9a-f]{24}$/i;

function fields(payload) {
  return payload !== null && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
}

function listingIdOr400(listingId) {
  if (typeof listingId !== "string" || !OBJECT_ID.test(listingId)) {
    throw new HttpError(400, "Invalid listing ID.");
  }
  return listingId.toLowerCase();
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
