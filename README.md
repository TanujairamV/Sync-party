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

### Windows

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

### Linux / macOS

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

# Usage

## Creating a Session

1. Open the Jam panel.
2. Start a new session.
3. Share the room code.
4. Manage playback and the shared queue.

## Joining a Session

1. Open the Jam panel.
2. Enter the room code.
3. Wait for synchronization.

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

---

# License

Released under the MIT License.

---

# Credits

* Base implementation by **Kyzenkms**
* Spicetify community
* Spotify
