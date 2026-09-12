const socket = io("/");
const videoGrid = document.getElementById("video-grid");
const queueList = document.getElementById("queueList");
const queueCount = document.getElementById("queueCount");

// Initialize PeerJS for WebRTC calls
const peer = new Peer(undefined, {
  host: "0.peerjs.com",
  port: 443,
  secure: true,
});

const peers = {}; // userId -> Peer call
const userStates = {}; // userId -> { name, isVideoOn, isAudioOn, isHandRaised }
let raisedHands = []; // List of { name, userId }
const myVideo = document.createElement("video");
myVideo.muted = true; // Mute self to prevent echo
let myStream;

let myPeerId = null;
let streamReady = false;
let peerReady = false;

// Get name from query or prompt
const urlParams = new URLSearchParams(window.location.search);
let initialName = urlParams.get("name");
if (!initialName || !initialName.trim()) {
  initialName = prompt("Enter your name:") || "Anonymous";
}
const userName = initialName.trim() || "Anonymous";

// Emit join-room once both media stream and peer ID are ready
function joinRoom() {
  if (myPeerId && streamReady) {
    const isVideoOn =
      myStream && myStream.getVideoTracks().length > 0
        ? myStream.getVideoTracks()[0].enabled
        : true;
    const isAudioOn =
      myStream && myStream.getAudioTracks().length > 0
        ? myStream.getAudioTracks()[0].enabled
        : true;
    socket.emit("join-room", ROOM_ID, myPeerId, userName, isVideoOn, isAudioOn);
  }
}

// Get user camera and mic
navigator.mediaDevices
  .getUserMedia({ video: true, audio: true })
  .then((stream) => {
    myStream = stream;
    streamReady = true;

    // Add local video to grid
    addVideoStream(myVideo, stream, `${userName} (You)`, true, "self");

    // Join room
    joinRoom();

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
    console.log("Media Error:", err);
    alert("Could not access camera/mic, please allow permissions.");
  });

// PeerJS connected
peer.on("open", (id) => {
  myPeerId = id;
  peerReady = true;
  joinRoom();
});

// Existing users already in room
socket.on("existing-users", (users) => {
  Object.keys(users).forEach((userId) => {
    if (userId === myPeerId) return;

    const u = users[userId];
    const uName = typeof u === "object" ? u.name : u;
    const uVideo = typeof u === "object" ? u.isVideoOn : true;
    const uAudio = typeof u === "object" ? u.isAudioOn : true;
    const uHand = typeof u === "object" ? Boolean(u.isHandRaised) : false;

    userStates[userId] = {
      name: uName,
      isVideoOn: uVideo,
      isAudioOn: uAudio,
      isHandRaised: uHand,
    };

    if (uHand && !raisedHands.some((h) => h.userId === userId)) {
      raisedHands.push({ name: uName, userId });
    }

    // Call existing user
    connectToNewUser(userId, myStream, uName);
  });

  updateQueueUI();
});

// New user joined
socket.on("user-connected", (userId, uData) => {
  const uName = typeof uData === "object" ? uData.name : uData;
  const uVideo = typeof uData === "object" ? uData.isVideoOn : true;
  const uAudio = typeof uData === "object" ? uData.isAudioOn : true;
  const uHand = typeof uData === "object" ? Boolean(uData.isHandRaised) : false;

  userStates[userId] = {
    name: uName,
    isVideoOn: uVideo,
    isAudioOn: uAudio,
    isHandRaised: uHand,
  };

  if (uHand && !raisedHands.some((h) => h.userId === userId)) {
    raisedHands.push({ name: uName, userId });
    updateQueueUI();
  }
});

// User disconnected
socket.on("user-disconnected", (userId) => {
  if (peers[userId]) {
    peers[userId].close();
    delete peers[userId];
  }
  delete userStates[userId];

  const videoBox = document.getElementById(`box-${userId}`);
  if (videoBox) videoBox.remove();

  raisedHands = raisedHands.filter((h) => h.userId !== userId);
  updateQueueUI();
});

// Remote camera toggle
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

// Remote mic toggle
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

// Hand raise events
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

// Update hand queue sidebar and badge
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

// Call a new peer
function connectToNewUser(userId, stream, remoteName) {
  if (!userId || userId === myPeerId) return;
  if (peers[userId]) return;

  const name = remoteName || userStates[userId]?.name || "Participant";
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

// Add video element to grid with name tag, camera off screen, and mic indicator
function addVideoStream(video, stream, name, isSelf, userId) {
  const existingBox = document.getElementById(`box-${userId}`);
  if (existingBox) {
    const existingVideo = existingBox.querySelector("video");
    if (existingVideo) {
      existingVideo.srcObject = stream;
      if (isSelf) {
        existingVideo.muted = true;
      } else {
        existingVideo.muted = false;
        existingVideo.volume = 1.0;
      }
      existingVideo.play().catch((e) => console.log("Video play error:", e));
    }
    return;
  }

  const box = document.createElement("div");
  box.className = "video-box";
  box.id = `box-${userId}`;

  video.srcObject = stream;
  video.autoplay = true;
  video.playsInline = true;

  if (isSelf) {
    video.muted = true;
  } else {
    video.muted = false;
    video.volume = 1.0;
  }

  const playMedia = () => {
    video.play().catch((err) => {
      console.warn("Autoplay was prevented, attempting to unlock on user interaction:", err);
      const unlockAudio = () => {
        video.play().catch((e) => console.log("Unlock play error:", e));
      };
      window.addEventListener("click", unlockAudio, { once: true });
      window.addEventListener("touchstart", unlockAudio, { once: true });
      window.addEventListener("keydown", unlockAudio, { once: true });
    });
  };

  video.addEventListener("loadedmetadata", playMedia);
  playMedia();

  // Check if camera is on
  let isVideoOn = true;
  if (isSelf) {
    isVideoOn =
      stream && stream.getVideoTracks().length > 0
        ? stream.getVideoTracks()[0].enabled
        : true;
  } else if (userStates[userId] && userStates[userId].isVideoOn !== undefined) {
    isVideoOn = userStates[userId].isVideoOn;
  }

  // Black screen with initials when camera is off
  const initials = (name || "U").substring(0, 2).toUpperCase();
  const blackScreen = document.createElement("div");
  blackScreen.className = `black-screen ${isVideoOn ? "hidden" : ""}`;
  blackScreen.id = `black-screen-${userId}`;
  blackScreen.innerHTML = `
    <div class="black-screen-avatar">${initials}</div>
    <div class="black-screen-name">${name}</div>
    <div class="black-screen-status"><i class="fas fa-video-slash"></i> Camera Off</div>
  `;

  // Name tag
  const nameTag = document.createElement("div");
  nameTag.className = "video-name";
  nameTag.innerHTML = `<i class="fas fa-user"></i> ${name}`;

  // Check if mic is on
  let isAudioOn = true;
  if (isSelf) {
    isAudioOn =
      stream && stream.getAudioTracks().length > 0
        ? stream.getAudioTracks()[0].enabled
        : true;
  } else if (userStates[userId] && userStates[userId].isAudioOn !== undefined) {
    isAudioOn = userStates[userId].isAudioOn;
  }

  // Mic indicator
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

// Copy clean room URL
document.getElementById("roomCodeNo").innerHTML = `Room Code: ${ROOM_ID}`;

document.getElementById("roomCode").addEventListener("click", () => {
  const roomUrl = `${window.location.origin}/room/${ROOM_ID}`;
  navigator.clipboard.writeText(roomUrl);
  document.getElementById("copyStatus").innerText = "Copied to clipboard!";
  setTimeout(() => {
    document.getElementById("copyStatus").innerText = "";
  }, 2000);
});

// Toggle mic
document.getElementById("muteButton").addEventListener("click", () => {
  if (!myStream) return;
  const audioTrack = myStream.getAudioTracks()[0];
  if (!audioTrack) return;

  const isAudioOn = !audioTrack.enabled;
  audioTrack.enabled = isAudioOn;

  document.getElementById("muteIcon").className = isAudioOn
    ? "fas fa-microphone"
    : "fas fa-microphone-slash";

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

  socket.emit("toggle-audio", isAudioOn);
});

// Toggle camera
document.getElementById("videoButton").addEventListener("click", () => {
  if (!myStream) return;
  const videoTrack = myStream.getVideoTracks()[0];
  if (!videoTrack) return;

  const isVideoOn = !videoTrack.enabled;
  videoTrack.enabled = isVideoOn;

  document.getElementById("videoIcon").className = isVideoOn
    ? "fas fa-video"
    : "fas fa-video-slash";

  const selfBlackScreen = document.getElementById("black-screen-self");
  if (selfBlackScreen) {
    if (isVideoOn) {
      selfBlackScreen.classList.add("hidden");
    } else {
      selfBlackScreen.classList.remove("hidden");
    }
  }

  socket.emit("toggle-video", isVideoOn);
});

// Leave room
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

// Raise / Lower hand
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

// Toggle hand queue sidebar
const queueBtn = document.getElementById("queueBtn");
const queueSidebar = document.getElementById("queueSidebar");
const closeQueueSidebar = document.getElementById("closeQueueSidebar");

if (queueBtn && queueSidebar) {
  queueBtn.addEventListener("click", () => {
    if (chatSidebar && !chatSidebar.classList.contains("hidden")) {
      chatSidebar.classList.add("hidden");
    }
    queueSidebar.classList.toggle("hidden");
  });
}

if (closeQueueSidebar && queueSidebar) {
  closeQueueSidebar.addEventListener("click", () => {
    queueSidebar.classList.add("hidden");
  });
}

// Chat sidebar & messaging
const chatBtn = document.getElementById("chatBtn");
const chatSidebar = document.getElementById("chatSidebar");
const closeChatSidebar = document.getElementById("closeChatSidebar");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const chatMessages = document.getElementById("chatMessages");
const chatBadge = document.getElementById("chatBadge");
let unreadChatCount = 0;

if (chatBtn && chatSidebar) {
  chatBtn.addEventListener("click", () => {
    if (queueSidebar && !queueSidebar.classList.contains("hidden")) {
      queueSidebar.classList.add("hidden");
    }
    const isHidden = chatSidebar.classList.toggle("hidden");
    if (!isHidden) {
      unreadChatCount = 0;
      if (chatBadge) chatBadge.classList.add("hidden");
      if (chatInput) chatInput.focus();
    }
  });
}

if (closeChatSidebar && chatSidebar) {
  closeChatSidebar.addEventListener("click", () => {
    chatSidebar.classList.add("hidden");
  });
}

// Send chat message
if (chatForm && chatInput) {
  chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const msg = chatInput.value.trim();
    if (msg) {
      socket.emit("send-message", msg);
      chatInput.value = "";
    }
  });
}

// Receive chat message
socket.on("receive-message", (data) => {
  const { userId, userName: senderName, message, time } = data;
  const isSelf = userId === myPeerId;

  if (chatMessages) {
    const emptyNotice = chatMessages.querySelector(".chat-empty");
    if (emptyNotice) emptyNotice.remove();

    const msgDiv = document.createElement("div");
    msgDiv.className = `chat-msg ${isSelf ? "self" : ""}`;
    msgDiv.innerHTML = `
      <div class="chat-msg-header">
        <span class="chat-msg-sender">${isSelf ? "You" : senderName}</span>
        <span class="chat-msg-time">${time || ""}</span>
      </div>
      <div class="chat-msg-text">${escapeHtml(message)}</div>
    `;

    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // Show badge if chat sidebar is closed
  if (!isSelf && chatSidebar && chatSidebar.classList.contains("hidden")) {
    unreadChatCount++;
    if (chatBadge) {
      chatBadge.innerText = unreadChatCount;
      chatBadge.classList.remove("hidden");
    }
  }
});

// Escape HTML for chat safety
function escapeHtml(text) {
  const div = document.createElement("div");
  div.innerText = text;
  return div.innerHTML;
}
