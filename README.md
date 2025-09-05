# WebRTC Video Room App

A simple video collaboration app for study groups, built with Express, Socket.IO, PeerJS, and WebRTC.  
A hands-on project to explore peer-to-peer video calling, showcasing real-time video calls and offering room for future features and improvements.

---

## Features

- Create or join video rooms with a unique code
- Peer-to-peer video calls using WebRTC
- Real-time signaling with Socket.IO
- Mute/unmute microphone and toggle video
- Responsive UI with EJS templates

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/)
- [npm](https://www.npmjs.com/)

### Installation

```bash
git clone https://github.com/NuhaG/webrtc-video-room.git
```

```bash
cd webrtc-video-room
```

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

## Usage

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

---

## Project Structure

```
├── app.js
├── public/
│   └── script.js
├── views/
│   ├── home.ejs
│   └── room.ejs
├── package.json
├── package-lock.json
└── .gitignore
```

---

## Dependencies

- express
- socket.io
- ejs
- uuid
- peerjs

---

## Future Improvements

- Add text chat functionality
- Implement screen sharing
- Enable recording
- Authentication for private rooms
- Explore scalable WebRTC solutions using SFU/MCU servers

---

## Contributions

Contributions are welcome!  
You can report issues, suggest features, or submit pull requests to improve the project.

---
