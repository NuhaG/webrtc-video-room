// server.js (ESM)
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
app.get("/room/:room", (req, res) => res.render("room", { roomId: req.params.room }));

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  // Store room and user on the socket when they join
  socket.on("join-room", (roomId, userId) => {
    if (!roomId || !userId) return;
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.userId = userId;
    console.log(`User ${userId} joined room ${roomId}`);
    socket.to(roomId).emit("user-connected", userId);
  });

  // Hand raise / lower: accept either (roomId, userName) or just userName if you later change client
  socket.on("handRaised", (roomIdOrName, maybeName) => {
    const room = typeof maybeName === "string" ? roomIdOrName : socket.data.roomId;
    const name = typeof maybeName === "string" ? maybeName : roomIdOrName;
    if (room) socket.to(room).emit("userHandRaised", name);
  });

  socket.on("handLowered", (roomIdOrName, maybeName) => {
    const room = typeof maybeName === "string" ? roomIdOrName : socket.data.roomId;
    const name = typeof maybeName === "string" ? maybeName : roomIdOrName;
    if (room) socket.to(room).emit("userHandLowered", name);
  });

  // Clean disconnect: only emit if we stored info earlier
  socket.on("disconnect", () => {
    const { roomId, userId } = socket.data;
    if (roomId && userId) {
      socket.to(roomId).emit("user-disconnected", userId);
      console.log(`User ${userId} disconnected from ${roomId}`);
    } else {
      console.log(`Socket ${socket.id} disconnected before joining a room`);
    }
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () => console.log(`Server running on port ${port}`));
