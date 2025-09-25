import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { v4 as uuidV4 } from "uuid";

const app = express();
const server = createServer(app);
const io = new Server(server);

app.set("view engine", "ejs");
app.use(express.static("public"));

// Home route → generates new room if requested
app.get("/", (req, res) => {
  res.render("home");
});

app.get("/room", (req, res) => {
  const roomId = uuidV4(); // generate random room code
  res.redirect(`/room/${roomId}`);
});

app.get("/room/:room", (req, res) => {
  res.render("room", { roomId: req.params.room });
});

// Socket.IO handling
io.on("connection", (socket) => {
  socket.on("join-room", (roomId, userId) => {
    socket.join(roomId);
    socket.to(roomId).emit("user-connected", userId);

    // Hand Raise
    socket.on("handRaised", (roomId, userName) => {
      socket.to(roomId).emit("userHandRaised", userName);
    });

    // Disconnect
    socket.on("disconnect", () => {
      socket.to(roomId).emit("user-disconnected", userId);
    });
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Server running on port ${port}...`);
});
