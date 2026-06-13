<div align="center">

# 🎵 Sync Party

<div align="center">
  <img src="https://raw.githubusercontent.com/TanujairamV/spicetify-jam/main/assets/logo.png" alt="Spicetify Jam Banner" width="32%" />

<p align="center">
  <img src="https://readme-typing-svg.herokuapp.com?font=Lexend+Giga&size=30&pause=1200&color=1db954&center=true&vCenter=true&width=900&lines=Real+time+listening+sessions+for+Spotify;Listen+with+your+friends" />
</p>

<p>
  <img src="https://img.shields.io/badge/version-1.0.0-1db954?style=for-the-badge&logo=spotify">
  <img src="https://img.shields.io/badge/spicetify-extension-1db954?style=for-the-badge">
  <img src="https://img.shields.io/badge/license-MIT-blue?style=for-the-badge">
</p>

</div>

Spicetify Jam is a Spicetify extension that enables synchronized listening sessions between Spotify users. It provides real-time playback synchronization, a shared queue, optional collaborative controls, and integrated session management directly within the Spotify client.

---

# Features

## Playback Synchronization

* Real-time playback synchronization
* Predictive playback compensation
* Automatic drift correction
* Track, play, pause, and seek synchronization
* Manual synchronization requests

---

# Installation

## Prerequisites

* Spotify Desktop
* Spicetify
* Node.js
* Git

## Windows

```powershell
winget install --id Git.Git -e --source winget
winget install OpenJS.NodeJS.LTS
Set-ExecutionPolicy RemoteSigned -Scope Current

git clone https://github.com/TanujairamV/spicetify-jam
cd spicetify-jam

npm install
npm run build

spicetify config extensions spicetify-jam.js
spicetify apply
```

## Linux / macOS

```bash
git clone https://github.com/TanujairamV/spicetify-jam
cd spicetify-jam

npm install
npm run build

spicetify config extensions spicetify-jam.js
spicetify apply
```

---

## Shared Queue

* Shared session queue
* Add and remove tracks
* Queue reordering
* Queue state synchronization

## Session Management

* Host and guest roles
* 6-character room codes
* Join links
* Member list synchronization
* Automatic reconnection

## Collaborative Controls

Host-configurable guest permissions:

* Play
* Pause
* Next
* Previous
* Seek

## Spotify Integration

* Native Spotify interface
* Spotify profile pictures
* Current track information
* Playback state tracking

---

# Architecture

Spicetify Jam uses a peer-to-peer architecture for low-latency communication.

```
Host
 │
 │ WebRTC
 │
 ├──── Guest 1
 ├──── Guest 2
 └──── Guest n
```

The host maintains the authoritative playback state while guests synchronize to the host.

## Networking

* WebRTC peer connections
* Lightweight signaling layer
* Automatic connection management
* Ping and latency measurement

## Synchronization

Current synchronization pipeline:

```
Host Action
      │
      ▼
Create Event
      │
      ▼
Timestamp Packet
      │
      ▼
Transmit
      │
      ▼
Predict Playback Position
      │
      ▼
Calculate Drift
      │
      ▼
Apply Correction
```

---

# Project Structure

```
src/
├── components/
├── network/
│   ├── messageHandlers.ts
│   ├── peerManager.ts
│   ├── signaling.ts
│   ├── webrtc.ts
│   └── WebRTCPeerManager.ts
├── spotify/
│   └── player.ts
├── types/
├── utils/
│   └── sync.ts
├── JamContext.tsx
└── app.tsx
```

## Main Components

| Component      | Purpose                       |
| -------------- | ----------------------------- |
| `components` | User interface                |
| `network`    | WebRTC and session management |
| `spotify`    | Spotify playback integration  |
| `utils`      | Synchronization algorithms    |
| `types`      | Shared TypeScript definitions |

---

# Usage

## Creating a Session

1. Open the Jam panel.
2. Start a new session.
3. Share the room code or join link.
4. Manage playback and the shared queue.

## Joining a Session

1. Open the Jam panel.
2. Enter the room code or use a join link.
3. Wait for synchronization.

---

# Synchronization

Spicetify Jam currently implements:

## Predictive Synchronization

Incoming playback packets contain:

* Track URI
* Playback position
* Timestamp
* Playback state

The receiving client predicts the host's current playback position by compensating for network latency.

## Drift Correction

Small timing differences are ignored to avoid unnecessary playback interruptions.

Large playback deviations trigger automatic correction.

---

# Message Protocol

Common message types:

| Message | Purpose                  |
| ------- | ------------------------ |
| JOIN    | Join session             |
| INIT    | Initial session state    |
| MEMBERS | Member updates           |
| PLAY    | Playback synchronization |
| PAUSE   | Pause synchronization    |
| SEEK    | Seek synchronization     |
| Q       | Queue updates            |
| ADD_Q   | Add queue item           |
| RM_Q    | Remove queue item        |
| PING    | Latency measurement      |
| PONG    | Latency response         |
| SYNC    | Manual synchronization   |

---

# Development

## Build

```bash
npm run build
```

## Apply

```bash
spicetify apply
```

## Build and Apply

```bash
npm run build
spicetify apply
```

---

# Roadmap

Current implementation includes:

* Real-time playback synchronization
* Predictive playback compensation
* Drift correction
* Shared queue
* Collaborative controls
* Session management
* WebRTC networking

Planned improvements:

* Enhanced synchronization
* Improved queue consistency
* Connection resilience
* Additional collaborative features

---

# Contributing

Contributions are welcome.

* Report bugs
* Suggest features
* Submit pull requests
* Improve documentation

---

# License

Released under the MIT License.

---

# Credits

* Base implementation by **Kyzenkms**
* Spicetify community
* Spotify
