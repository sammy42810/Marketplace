// Imported by server.js, which runs unbundled: relative imports only, no "@/".
import { Server } from "socket.io";
import { getAdminAuth } from "./firebaseAdmin.js";

export function attachSockets(httpServer) {
  const io = new Server(httpServer);

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== "string" || token.length === 0)
      return next(new Error("unauthorized"));
    try {
      const decoded = await getAdminAuth().verifyIdToken(token);
      socket.data.uid = decoded.uid;
      next();
    } catch (error) {
      console.error("Socket auth failed:", error.message);
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    // Lets the server reach one user on every tab they have open.
    socket.join(`user:${socket.data.uid}`);

    socket.on("ping", (ack) => {
      if (typeof ack === "function") ack({ serverTime: Date.now() });
    });


    // Let users join auction rooms
    socket.on("auction:join", ({ listingId } = {}, ack) => {
      if (typeof listingId !== "string" || !/^[0-9a-f]{24}$/i.test(listingId)) {
        if (typeof ack === "function") ack({ error: "Invalid listing ID." });
        return;
      }

      socket.join(`auction:${listingId.toLowerCase()}`);

      if (typeof ack === "function") ack({ ok: true });
    });

    // Let users leave auction rooms
    socket.on("auction:leave", ({ listingId } = {}, ack) => {
      if (typeof listingId !== "string" || !/^[0-9a-f]{24}$/i.test(listingId)) {
        if (typeof ack === "function") ack({ error: "Invalid listing ID." });
        return;
      }

      socket.leave(`auction:${listingId.toLowerCase()}`);

      if (typeof ack === "function") ack({ ok: true });
    });
  });

  return io;
}
