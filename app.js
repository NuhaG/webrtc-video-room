// main backend server handling:
// http routes (ejs pages), socket.io signalling, room state tracing

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { v4 as uuidV4 } from "uuid";

const app = express();
const server = createServer(app);
const io = new Server(server);

app.set("view engine", "ejs");
app.use(express.static("public"));

app.get("/", (req, res) => res.render("home"));
app.get("/room", (req, res) => res.redirect(`/room/${uuidV4()}`));
app.get("/room/:room", (req, res) => {
  res.render("room", { roomId: req.params.room });
});

const rooms = {};

io.on("connection", (socket) => {
  console.log("Socket Connected:", socket.id);

  // join room
  // Flow:
  // 1. User joins room
  // 2. Server sends existing users to new user
  // 3. Server adds new user to room list
  // 4. Server notifies others
  socket.on("join-room", (roomId, userId) => {
    if (!roomId || !userId) return;

    socket.join(roomId);

    // store metadata on socket for disconnect cleanup
    socket.data.roomId = roomId;
    socket.data.userId = userId;

    // Create room if it doesn't exist
    if (!rooms[roomId]) {
      rooms[roomId] = new Set();
    }

    // IMPORTANT FIX:
    // Add user FIRST so state is correct for everyone
    rooms[roomId].add(userId);

    // Send full updated list (safe and consistent)
    const existingUsers = Array.from(rooms[roomId]);

    // Send list AFTER adding user
    socket.emit(
      "existing-users",
      existingUsers.filter((id) => id !== userId),
    );

    console.log(`User ${userId} joined room ${roomId}`);
  });

  // hand raise
  socket.on("handRaised", (roomIdOrName, maybeName) => {
    const room =
      typeof maybeName === "string" ? roomIdOrName : socket.data.roomId;
    const name = typeof maybeName === "string" ? maybeName : roomIdOrName;

    if (room) socket.to(room).emit("userHandRaised", name);
  });

  socket.on("handLowered", (roomIdOrName, maybeName) => {
    const room =
      typeof maybeName === "string" ? roomIdOrName : socket.data.roomId;
    const name = typeof maybeName === "string" ? maybeName : roomIdOrName;

    if (room) socket.to(room).emit("userHandLowered", name);
  });

  // disconnect
  socket.on("disconnect", () => {
    const { roomId, userId } = socket.data;

    if (roomId && userId && rooms[roomId]) {
      rooms[roomId].delete(userId);

      socket.to(roomId).emit("user-disconnected", userId);

      console.log(`User ${userId} disconnected from ${roomId}`);
    } else {
      console.log(`Socket ${socket.id} disconnected early`);
    }
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Server is running on port ${port}...`);
});
