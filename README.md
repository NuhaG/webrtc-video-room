# 💻 WebRTC Video Room App

A simple video collaboration app for study groups, built with Express, Socket.IO, PeerJS, and WebRTC.  
A hands-on project to explore peer-to-peer video calling, showcasing real-time video calls and offering room for future features and improvements.

---

## ✨ Features

- Create or join video rooms with a unique code
- Peer-to-peer video calls using WebRTC
- Real-time signaling with Socket.IO
- Real-time in-call text chat with unread message badges
- Mute/unmute microphone and toggle video
- Raise hand and raised hands queue sidebar
- Participant status indicators (camera off avatars, mute status)
- Copy room codes for easy sharing
- Responsive UI with EJS templates

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/)
- [npm](https://www.npmjs.com/)

### Installation

#### 1. Clone
```bash
git clone https://github.com/NuhaG/webrtc-video-room.git
```

#### 2. Navigate to folder
```bash
cd webrtc-video-room
```

#### 3. Install dependencies
```bash
npm install
```

### Running the App

Start the server in development mode:

```bash
npm run dev
```

Open your browser and go to [http://localhost:3000](http://localhost:3000).

**Note:**  
You need a PeerJS server running on port 3001 for video calls to work.  
You can run your own PeerJS server with:

```bash
npx peerjs --port 3001
```

Or use a public PeerJS server by updating the PeerJS config in `public/script.js`.

---

## 👥 Usage

- **Create a New Room:**  
  Click "Join New Room" on the home page.

- **Join a Room:**  
  Enter a room code and click "Join", You can also create your own room code.

- **Share Room Code:**  
  Copy the code shown at the top of the room page and share with others.

- **Controls:**
  - Mute/unmute microphone
  - Toggle video
  - Leave room
  - Raise hand
  - View raised hands queue
  - Live in-call text chat

---

## 📂 Project Structure

```
├── app.js
├── public/
│   ├── home.css
│   ├── script.js
│   └── style.css
├── views/
│   ├── home.ejs
│   └── room.ejs
├── package.json
├── package-lock.json
└── .gitignore
```

---

## 📦 Dependencies

- express
- socket.io
- ejs
- uuid
- peerjs

---

## 🔮 Future Improvements

- Implement screen sharing
- Enable recording
- Authentication for private rooms
- Explore scalable WebRTC solutions using SFU/MCU servers
- Improve notifications

---

## 🤝 Contributions

Contributions are welcome!  
You can report issues, suggest new features, or submit pull requests to improve the project.

---
