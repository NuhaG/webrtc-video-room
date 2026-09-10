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
app.get("/room", (req, res) => {
  const nameQuery = req.query.name ? `?name=${encodeURIComponent(req.query.name)}` : "";
  res.redirect(`/room/${uuidV4()}${nameQuery}`);
});
app.get("/room/:room", (req, res) => {
  res.render("room", { roomId: req.params.room });
});

const rooms = {}; // roomId -> { [userId]: { name, isVideoOn, isAudioOn } }

io.on("connection", (socket) => {
  console.log("Socket Connected:", socket.id);

  // join room
  socket.on("join-room", (roomId, userId, userName, isVideoOn = true, isAudioOn = true) => {
    if (!roomId || !userId) return;

    socket.join(roomId);

    // store metadata on socket for disconnect cleanup
    socket.data.roomId = roomId;
    socket.data.userId = userId;
    socket.data.userName = userName || "Anonymous";

    if (!rooms[roomId]) {
      rooms[roomId] = {};
    }

    rooms[roomId][userId] = {
      name: userName || "Anonymous",
      isVideoOn: isVideoOn !== false,
      isAudioOn: isAudioOn !== false,
      isHandRaised: false,
    };

    // Send existing users with their current video/audio/hand states to new user
    socket.emit("existing-users", rooms[roomId]);

    // Notify others
    socket.to(roomId).emit("user-connected", userId, rooms[roomId][userId]);

    console.log(`User ${userName} (${userId}) joined room ${roomId}`);
  });

  // video state toggle
  socket.on("toggle-video", (isVideoOn) => {
    const { roomId, userId } = socket.data;
    if (roomId && userId && rooms[roomId] && rooms[roomId][userId]) {
      rooms[roomId][userId].isVideoOn = isVideoOn;
      socket.to(roomId).emit("user-toggle-video", userId, isVideoOn);
    }
  });

  // audio state toggle
  socket.on("toggle-audio", (isAudioOn) => {
    const { roomId, userId } = socket.data;
    if (roomId && userId && rooms[roomId] && rooms[roomId][userId]) {
      rooms[roomId][userId].isAudioOn = isAudioOn;
      socket.to(roomId).emit("user-toggle-audio", userId, isAudioOn);
    }
  });

  // hand raise
  socket.on("handRaised", (roomIdOrName, maybeName) => {
    const room =
      typeof maybeName === "string" ? roomIdOrName : socket.data.roomId;
    const name =
      typeof maybeName === "string" ? maybeName : socket.data.userName || roomIdOrName;
    const userId = socket.data.userId;

    if (room && userId && rooms[room] && rooms[room][userId]) {
      rooms[room][userId].isHandRaised = true;
    }

    if (room) io.in(room).emit("userHandRaised", name, userId);
  });

  socket.on("handLowered", (roomIdOrName, maybeName) => {
    const room =
      typeof maybeName === "string" ? roomIdOrName : socket.data.roomId;
    const name =
      typeof maybeName === "string" ? maybeName : socket.data.userName || roomIdOrName;
    const userId = socket.data.userId;

    if (room && userId && rooms[room] && rooms[room][userId]) {
      rooms[room][userId].isHandRaised = false;
    }

    if (room) io.in(room).emit("userHandLowered", name, userId);
  });

  // disconnect
  socket.on("disconnect", () => {
    const { roomId, userId, userName } = socket.data;

    if (roomId && userId && rooms[roomId]) {
      delete rooms[roomId][userId];
      if (Object.keys(rooms[roomId]).length === 0) {
        delete rooms[roomId];
      }

      socket.to(roomId).emit("user-disconnected", userId, userName);

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

