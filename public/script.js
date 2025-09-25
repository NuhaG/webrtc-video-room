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

// username prompt
const userName = prompt("Enter your name:") || "Anonymous";

// Get local stream
navigator.mediaDevices
  .getUserMedia({ video: true, audio: true })
  .then((stream) => {
    myStream = stream;
    addVideoStream(myVideo, stream);

    // Answer incoming calls
    peer.on("call", (call) => {
      call.answer(stream);
      const video = document.createElement("video");
      call.on("stream", (userVideoStream) => {
        addVideoStream(video, userVideoStream);
      });
    });

    // When a new user connects
    socket.on("user-connected", (userId) => {
      connectToNewUser(userId, stream);
    });
  });

// When a user disconnects
socket.on("user-disconnected", (userId) => {
  if (peers[userId]) peers[userId].close();
});

// When PeerJS is ready, join the room
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

// Append video to the grid
function addVideoStream(video, stream) {
  video.srcObject = stream;
  video.addEventListener("loadedmetadata", () => {
    video.play();
  });
  videoGrid.append(video);
}

// Add Room code on top
document.getElementById("roomCodeNo").innerHTML = `Room Code: ${ROOM_ID}`;

// Copy room link on click
document.getElementById("roomCode").addEventListener("click", () => {
  navigator.clipboard
    .writeText(window.location.href)
    .then(() => {
      const status = document.getElementById("copyStatus");
      status.innerText = "Link Copied!";
      setTimeout(() => {
        status.innerText = "";
      }, 3000);
    })
    .catch(() => {
      alert("Failed to copy link");
    });
});

// Button Controls
// Mute/Unmute
document.getElementById("muteButton").addEventListener("click", () => {
  const enabled = myStream.getAudioTracks()[0].enabled;
  if (enabled) {
    myStream.getAudioTracks()[0].enabled = false;
    document.getElementById("muteIcon").className = "fas fa-microphone-slash";
  } else {
    myStream.getAudioTracks()[0].enabled = true;
    document.getElementById("muteIcon").className = "fas fa-microphone";
  }
});

// Video On/Off
document.getElementById("videoButton").addEventListener("click", () => {
  const enabled = myStream.getVideoTracks()[0].enabled;
  if (enabled) {
    myStream.getVideoTracks()[0].enabled = false;
    document.getElementById("videoIcon").className = "fas fa-video-slash";
  } else {
    myStream.getVideoTracks()[0].enabled = true;
    document.getElementById("videoIcon").className = "fas fa-video";
  }
});

// End Call
document.getElementById("leaveButton").addEventListener("click", () => {
  for (let userId in peers) {
    peers[userId].close();
  }
  myStream.getTracks().forEach(track => track.stop());
  myVideo.remove();

  window.location.href = "/";
});


// Raise Hand
const handBtn = document.getElementById("hand");
let handRaised = false;

// Send hand raise signal
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

// Other users raising their hand
socket.on("userHandRaised", (name) => {
  alert(`${name} has raised their hand!`);
});