const socket = io("/"); // connects to your server, used to signal others on join or leave
const videoGrid = document.getElementById("video-grid");
const queueList = document.getElementById("queueList");
const queueCount = document.getElementById("queueCount");

// peerjs connected to WebRTC, server on port 3001
const peer = new Peer(undefined, {
  host: "0.peerjs.com",
  port: 443,
  secure: true,
});

const peers = {};
const userStates = {}; // userId -> { name, isVideoOn, isAudioOn }
let raisedHands = []; // array of { name, userId }
const myVideo = document.createElement("video");
myVideo.muted = true; // mutes self (speaker)
let myStream;

// Sync readiness
let myPeerId = null;
let streamReady = false;
let peerReady = false;

// Resolve Name: check URL param -> ask via prompt when joining via invite link
const urlParams = new URLSearchParams(window.location.search);
let initialName = urlParams.get("name");
if (!initialName || !initialName.trim()) {
  initialName = prompt("Enter your name:") || "Anonymous";
}
const userName = initialName.trim() || "Anonymous";

// join when both ready
function joinRoom() {
  if (myPeerId && streamReady) {
    const isVideoOn = myStream && myStream.getVideoTracks().length > 0 ? myStream.getVideoTracks()[0].enabled : true;
    const isAudioOn = myStream && myStream.getAudioTracks().length > 0 ? myStream.getAudioTracks()[0].enabled : true;
    socket.emit("join-room", ROOM_ID, myPeerId, userName, isVideoOn, isAudioOn);
  }
}

// Get local stream FIRST
navigator.mediaDevices
  .getUserMedia({ video: true, audio: true })
  .then((stream) => {
    myStream = stream;
    streamReady = true;

    addVideoStream(myVideo, stream, `${userName} (You)`, true, "self");

    joinRoom(); // attempt join

    // Answer incoming calls
    peer.on("call", (call) => {
      call.answer(stream);

      const video = document.createElement("video");
      const callerId = call.peer;
      const callerName = userStates[callerId]?.name || "Participant";

      call.on("stream", (userVideoStream) => {
        addVideoStream(video, userVideoStream, callerName, false, callerId);
      });
    });
  })
  .catch((err) => {
    console.log("Media Request Error:", err);
    alert("Could not access media, allow to continue.");
  });

// Existing users
socket.on("existing-users", (users) => {
  // users is { [userId]: { name, isVideoOn, isAudioOn, isHandRaised } }
  Object.keys(users).forEach((userId) => {
    if (userId === myPeerId) return;
    const u = users[userId];
    const uName = typeof u === "object" ? u.name : u;
    const uVideo = typeof u === "object" ? u.isVideoOn : true;
    const uAudio = typeof u === "object" ? u.isAudioOn : true;
    const uHand = typeof u === "object" ? Boolean(u.isHandRaised) : false;
    userStates[userId] = { name: uName, isVideoOn: uVideo, isAudioOn: uAudio, isHandRaised: uHand };

    if (uHand && !raisedHands.some((h) => h.userId === userId)) {
      raisedHands.push({ name: uName, userId });
    }

    connectToNewUser(userId, myStream, uName);
  });
  updateQueueUI();
});

// New user connected
socket.on("user-connected", (userId, uData) => {
  const uName = typeof uData === "object" ? uData.name : uData;
  const uVideo = typeof uData === "object" ? uData.isVideoOn : true;
  const uAudio = typeof uData === "object" ? uData.isAudioOn : true;
  const uHand = typeof uData === "object" ? Boolean(uData.isHandRaised) : false;
  userStates[userId] = { name: uName, isVideoOn: uVideo, isAudioOn: uAudio, isHandRaised: uHand };

  if (uHand && !raisedHands.some((h) => h.userId === userId)) {
    raisedHands.push({ name: uName, userId });
    updateQueueUI();
  }
});

// When a user disconnects
socket.on("user-disconnected", (userId) => {
  if (peers[userId]) {
    peers[userId].close();
    delete peers[userId];
  }
  delete userStates[userId];
  const videoBox = document.getElementById(`box-${userId}`);
  if (videoBox) videoBox.remove();

  // Remove from raised hands queue
  raisedHands = raisedHands.filter((h) => h.userId !== userId);
  updateQueueUI();
});

// Video track toggle from remote user
socket.on("user-toggle-video", (userId, isVideoOn) => {
  if (userStates[userId]) {
    userStates[userId].isVideoOn = isVideoOn;
  }
  const blackScreen = document.getElementById(`black-screen-${userId}`);
  if (blackScreen) {
    if (isVideoOn) {
      blackScreen.classList.add("hidden");
    } else {
      blackScreen.classList.remove("hidden");
    }
  }
});

// Audio track toggle from remote user
socket.on("user-toggle-audio", (userId, isAudioOn) => {
  if (userStates[userId]) {
    userStates[userId].isAudioOn = isAudioOn;
  }
  const micIndicator = document.getElementById(`mic-${userId}`);
  if (micIndicator) {
    if (isAudioOn) {
      micIndicator.className = "mic-indicator";
      micIndicator.innerHTML = '<i class="fas fa-microphone"></i>';
    } else {
      micIndicator.className = "mic-indicator muted";
      micIndicator.innerHTML = '<i class="fas fa-microphone-slash"></i>';
    }
  }
});

// Hand raise queue events
socket.on("userHandRaised", (name, userId) => {
  if (!raisedHands.some((h) => h.userId === userId || (userId && h.name === name))) {
    raisedHands.push({ name, userId });
    updateQueueUI();
  }
});

socket.on("userHandLowered", (name, userId) => {
  raisedHands = raisedHands.filter((h) => (userId ? h.userId !== userId : h.name !== name));
  updateQueueUI();
});

function updateQueueUI() {
  const count = raisedHands.length;
  const badge = document.getElementById("queueBadge");
  const modalCount = document.getElementById("modalQueueCount");
  const queueList = document.getElementById("queueList");

  if (badge) badge.innerText = count;
  if (modalCount) modalCount.innerText = count;

  if (queueList) {
    if (count === 0) {
      queueList.innerHTML = '<div class="queue-empty">No hands raised</div>';
      return;
    }

    queueList.innerHTML = "";
    raisedHands.forEach((item, index) => {
      const div = document.createElement("div");
      div.className = "queue-item";
      div.innerHTML = `<span class="queue-number">${index + 1}</span> <span>${item.name}</span>`;
      queueList.appendChild(div);
    });
  }
}

// Peer ready
peer.on("open", (id) => {
  myPeerId = id;
  peerReady = true;
  joinRoom();
});

// Call a new user
function connectToNewUser(userId, stream, remoteName) {
  if (!userId || userId === myPeerId) return;
  if (peers[userId]) return;

  const name = remoteName || userNames[userId] || "Participant";
  const call = peer.call(userId, stream);
  const video = document.createElement("video");

  call.on("stream", (userVideoStream) => {
    addVideoStream(video, userVideoStream, name, false, userId);
  });

  call.on("close", () => {
    const videoBox = document.getElementById(`box-${userId}`);
    if (videoBox) videoBox.remove();
    delete peers[userId];
  });

  peers[userId] = call;
}

// Append video to grid with person's name, black screen (when camera off), and mic indicator
function addVideoStream(video, stream, name, isSelf, userId) {
  const existingBox = document.getElementById(`box-${userId}`);
  if (existingBox) {
    const existingVideo = existingBox.querySelector("video");
    if (existingVideo) existingVideo.srcObject = stream;
    return;
  }

  const box = document.createElement("div");
  box.className = "video-box";
  box.id = `box-${userId}`;

  video.srcObject = stream;
  video.addEventListener("loadedmetadata", () => {
    video.play();
  });

  // Check if camera is currently on or off
  let isVideoOn = true;
  if (isSelf) {
    isVideoOn = stream && stream.getVideoTracks().length > 0 ? stream.getVideoTracks()[0].enabled : true;
  } else if (userStates[userId] && userStates[userId].isVideoOn !== undefined) {
    isVideoOn = userStates[userId].isVideoOn;
  }

  // Black screen with name when camera is off
  const initials = (name || "U").substring(0, 2).toUpperCase();
  const blackScreen = document.createElement("div");
  blackScreen.className = `black-screen ${isVideoOn ? "hidden" : ""}`;
  blackScreen.id = `black-screen-${userId}`;
  blackScreen.innerHTML = `
    <div class="black-screen-avatar">${initials}</div>
    <div class="black-screen-name">${name}</div>
    <div class="black-screen-status"><i class="fas fa-video-slash"></i> Camera Off</div>
  `;

  // Visible name label on video tile
  const nameTag = document.createElement("div");
  nameTag.className = "video-name";
  nameTag.innerHTML = `<i class="fas fa-user"></i> ${name}`;

  // Check if mic is currently on or off
  let isAudioOn = true;
  if (isSelf) {
    isAudioOn = stream && stream.getAudioTracks().length > 0 ? stream.getAudioTracks()[0].enabled : true;
  } else if (userStates[userId] && userStates[userId].isAudioOn !== undefined) {
    isAudioOn = userStates[userId].isAudioOn;
  }

  // Mic indicator badge (top right of video tile)
  const micIndicator = document.createElement("div");
  micIndicator.className = `mic-indicator ${isAudioOn ? "" : "muted"}`;
  micIndicator.id = `mic-${userId}`;
  micIndicator.innerHTML = `<i class="fas ${isAudioOn ? "fa-microphone" : "fa-microphone-slash"}"></i>`;

  box.appendChild(video);
  box.appendChild(blackScreen);
  box.appendChild(nameTag);
  box.appendChild(micIndicator);
  videoGrid.append(box);
}

// Room UI - Copy URL (only copy till room ID)
document.getElementById("roomCodeNo").innerHTML = `Room Code: ${ROOM_ID}`;

document.getElementById("roomCode").addEventListener("click", () => {
  const roomUrl = `${window.location.origin}/room/${ROOM_ID}`;
  navigator.clipboard.writeText(roomUrl);
  document.getElementById("copyStatus").innerText = "Copied to clipboard!";
  setTimeout(() => {
    document.getElementById("copyStatus").innerText = "";
  }, 2000);
});

// Mute toggle
document.getElementById("muteButton").addEventListener("click", () => {
  if (!myStream) return;
  const audioTrack = myStream.getAudioTracks()[0];
  if (!audioTrack) return;

  const isAudioOn = !audioTrack.enabled;
  audioTrack.enabled = isAudioOn;

  document.getElementById("muteIcon").className = isAudioOn
    ? "fas fa-microphone"
    : "fas fa-microphone-slash";

  // Update local tile mic indicator
  const selfMic = document.getElementById("mic-self");
  if (selfMic) {
    if (isAudioOn) {
      selfMic.className = "mic-indicator";
      selfMic.innerHTML = '<i class="fas fa-microphone"></i>';
    } else {
      selfMic.className = "mic-indicator muted";
      selfMic.innerHTML = '<i class="fas fa-microphone-slash"></i>';
    }
  }

  // Broadcast to peers
  socket.emit("toggle-audio", isAudioOn);
});

// Video toggle
document.getElementById("videoButton").addEventListener("click", () => {
  if (!myStream) return;
  const videoTrack = myStream.getVideoTracks()[0];
  if (!videoTrack) return;

  const isVideoOn = !videoTrack.enabled;
  videoTrack.enabled = isVideoOn;

  document.getElementById("videoIcon").className = isVideoOn
    ? "fas fa-video"
    : "fas fa-video-slash";

  // Toggle local black screen with name
  const selfBlackScreen = document.getElementById("black-screen-self");
  if (selfBlackScreen) {
    if (isVideoOn) {
      selfBlackScreen.classList.add("hidden");
    } else {
      selfBlackScreen.classList.remove("hidden");
    }
  }

  // Broadcast to other users in room
  socket.emit("toggle-video", isVideoOn);
});

// Leave
document.getElementById("leaveButton").addEventListener("click", () => {
  try {
    Object.values(peers).forEach((p) => p.close());
    if (myStream) myStream.getTracks().forEach((t) => t.stop());
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

// Raised Hands Queue Sidebar
const queueBtn = document.getElementById("queueBtn");
const queueSidebar = document.getElementById("queueSidebar");
const closeQueueSidebar = document.getElementById("closeQueueSidebar");

if (queueBtn && queueSidebar) {
  queueBtn.addEventListener("click", () => {
    queueSidebar.classList.toggle("hidden");
  });
}

if (closeQueueSidebar && queueSidebar) {
  closeQueueSidebar.addEventListener("click", () => {
    queueSidebar.classList.add("hidden");
  });
}


