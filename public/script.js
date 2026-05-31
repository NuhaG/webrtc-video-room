const socket = io("/"); // connects to your server, used to signal others on join or leave
const videoGrid = document.getElementById("video-grid");

// peerjs in connected to WebRTC, server on port 3001
const peer = new Peer(undefined, {
  host: "/",
  port: 3001,
});

const peers = {};
const myVideo = document.createElement("video");
myVideo.muted = true; // mutes self (speaker)
let myStream;

// IMPORTANT FIX: sync readiness
let myPeerId = null;
let streamReady = false;
let peerReady = false;

const userName = prompt("Enter your name:") || "Anonymous";

/*
  ===========================
  JOIN ONLY WHEN BOTH READY
  ===========================
*/
function joinRoom() {
  if (myPeerId && streamReady) {
    socket.emit("join-room", ROOM_ID, myPeerId);
  }
}

// Get local stream FIRST
navigator.mediaDevices
  .getUserMedia({ video: true, audio: true })
  .then((stream) => {
    myStream = stream;
    streamReady = true;

    addVideoStream(myVideo, stream);

    joinRoom(); // attempt join

    // Answer incoming calls
    peer.on("call", (call) => {
      call.answer(stream);

      const video = document.createElement("video");

      call.on("stream", (userVideoStream) => {
        addVideoStream(video, userVideoStream);
      });
    });
  })
  .catch((err) => {
    console.log("Media Request Error:", err);
    alert("Could not access media, allow to continue.");
  });

// Existing users (ONLY SOURCE OF CONNECTIONS)
socket.on("existing-users", (users) => {
  users.forEach((userId) => {
    if (userId === myPeerId) return;
    connectToNewUser(userId, myStream);
  });
});

// When a user disconnects
socket.on("user-disconnected", (userId) => {
  if (peers[userId]) {
    peers[userId].close();
    delete peers[userId];
  }
});

// Peer ready
peer.on("open", (id) => {
  myPeerId = id;
  peerReady = true;
  joinRoom();
});

// Call a new user
function connectToNewUser(userId, stream) {
  if (!userId || userId === myPeerId) return;
  if (peers[userId]) return;

  const call = peer.call(userId, stream);
  const video = document.createElement("video");

  call.on("stream", (userVideoStream) => {
    addVideoStream(video, userVideoStream);
  });

  call.on("close", () => {
    video.remove();
    delete peers[userId];
  });

  peers[userId] = call;
}

// Append video to grid
function addVideoStream(video, stream) {
  video.srcObject = stream;
  video.addEventListener("loadedmetadata", () => {
    video.play();
  });
  videoGrid.append(video);
}

// Room UI
document.getElementById("roomCodeNo").innerHTML = `Room Code: ${ROOM_ID}`;

document.getElementById("roomCode").addEventListener("click", () => {
  navigator.clipboard.writeText(window.location.href);
});

// Mute
document.getElementById("muteButton").addEventListener("click", () => {
  const enabled = myStream.getAudioTracks()[0].enabled;
  myStream.getAudioTracks()[0].enabled = !enabled;
  document.getElementById("muteIcon").className = enabled
    ? "fas fa-microphone-slash"
    : "fas fa-microphone";
});

// Video toggle
document.getElementById("videoButton").addEventListener("click", () => {
  const enabled = myStream.getVideoTracks()[0].enabled;
  myStream.getVideoTracks()[0].enabled = !enabled;
  document.getElementById("videoIcon").className = enabled
    ? "fas fa-video-slash"
    : "fas fa-video";
});

// Leave
document.getElementById("leaveButton").addEventListener("click", () => {
  try {
    Object.values(peers).forEach((p) => p.close());
    myStream.getTracks().forEach((t) => t.stop());
    socket.disconnect();
    peer.destroy();
  } finally {
    window.location.href = "/";
  }
});

// Hand raise
const handBtn = document.getElementById("hand");
let handRaised = false;

handBtn.addEventListener("click", () => {
  handRaised = !handRaised;

  if (handRaised) {
    handBtn.style.background = "#d3ba2bff";
    socket.emit("handRaised", ROOM_ID, userName);
  } else {
    handBtn.style.background = "#2a2a2a";
    socket.emit("handLowered", ROOM_ID, userName);
  }
});

socket.on("userHandRaised", (name) => {
  alert(`${name} has raised their hand!`);
});
