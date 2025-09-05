const socket = io("/");
const videoGrid = document.getElementById("video-grid");

const peer = new Peer(undefined, {
  host: "/",
  port: "3001", // Make sure you have a PeerJS server running here
});

const peers = {};
const myVideo = document.createElement("video");
myVideo.muted = true;

// Get local stream
navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
  addVideoStream(myVideo, stream);

  // Answer calls
  peer.on("call", (call) => {
    call.answer(stream);

    const video = document.createElement("video");
    call.on("stream", (userVideoStream) => {
      addVideoStream(video, userVideoStream);
    });
  });

  // When new user connects, call them
  socket.on("user-connected", (userId) => {
    connectToNewUser(userId, stream);
  });
});

// Handle when a user disconnects
socket.on("user-disconnected", (userId) => {
  if (peers[userId]) peers[userId].close();
});

// When PeerJS connects, tell server
peer.on("open", (id) => {
  socket.emit("join-room", ROOM_ID, id);
});

// Call a new user
function connectToNewUser(userId, stream) {
  const call = peer.call(userId, stream);
  const video = document.createElement("video");

  call.on("stream", (userVideoStream) => {
    addVideoStream(video, userVideoStream);
  });

  call.on("close", () => {
    video.remove();
  });

  peers[userId] = call;
}

// Helper to append video
function addVideoStream(video, stream) {
  video.srcObject = stream;
  video.addEventListener("loadedmetadata", () => {
    video.play();
  });
  videoGrid.append(video);
}
