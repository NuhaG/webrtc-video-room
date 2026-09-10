import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { v4 as uuidV4 } from "uuid";

const app = express();
const server = createServer(app);
const io = new Server(server);

app.set("view engine", "ejs");
app.use(express.static("public"));

// Home page
app.get("/", (req, res) => res.render("home"));

// Generate unique room ID and redirect
app.get("/room", (req, res) => {
  const nameQuery = req.query.name ? `?name=${encodeURIComponent(req.query.name)}` : "";
  res.redirect(`/room/${uuidV4()}${nameQuery}`);
});

// Render room page with roomId
app.get("/room/:room", (req, res) => {
  res.render("room", { roomId: req.params.room });
});

// Store room participants and their states (video, audio, hand raised)
const rooms = {};

io.on("connection", (socket) => {
  console.log("Socket Connected:", socket.id);

  // User joins room: save state, send existing users, notify others
  socket.on("join-room", (roomId, userId, userName, isVideoOn = true, isAudioOn = true) => {
    if (!roomId || !userId) return;

    socket.join(roomId);
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

    // Send existing users to the new participant
    socket.emit("existing-users", rooms[roomId]);

    // Notify other users in the room
    socket.to(roomId).emit("user-connected", userId, rooms[roomId][userId]);

    console.log(`User ${userName} (${userId}) joined room ${roomId}`);
  });

  // Camera toggle: update state and broadcast to peers
  socket.on("toggle-video", (isVideoOn) => {
    const { roomId, userId } = socket.data;
    if (roomId && userId && rooms[roomId] && rooms[roomId][userId]) {
      rooms[roomId][userId].isVideoOn = isVideoOn;
      socket.to(roomId).emit("user-toggle-video", userId, isVideoOn);
    }
  });

  // Mic toggle: update state and broadcast to peers
  socket.on("toggle-audio", (isAudioOn) => {
    const { roomId, userId } = socket.data;
    if (roomId && userId && rooms[roomId] && rooms[roomId][userId]) {
      rooms[roomId][userId].isAudioOn = isAudioOn;
      socket.to(roomId).emit("user-toggle-audio", userId, isAudioOn);
    }
  });

  // Hand raise: update state and broadcast to room
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

  // Hand lower: update state and broadcast to room
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

  // Live chat: broadcast message to everyone in the room
  socket.on("send-message", (message) => {
    const { roomId, userId, userName } = socket.data;
    if (roomId && message && message.trim()) {
      const time = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      io.in(roomId).emit("receive-message", {
        userId,
        userName: userName || "Anonymous",
        message: message.trim(),
        time,
      });
    }
  });

  // Disconnect: remove user from state and notify room
  socket.on("disconnect", () => {
    const { roomId, userId, userName } = socket.data;

    if (roomId && userId && rooms[roomId]) {
      delete rooms[roomId][userId];
      if (Object.keys(rooms[roomId]).length === 0) {
        delete rooms[roomId];
      }

      socket.to(roomId).emit("user-disconnected", userId, userName);
      console.log(`User ${userId} disconnected from ${roomId}`);
    }
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Server is running on port ${port}...`);
});
