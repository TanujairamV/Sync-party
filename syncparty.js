(async function() {
        while (!Spicetify.React || !Spicetify.ReactDOM) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        var syncparty = (() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // external-global-plugin:react
  var require_react = __commonJS({
    "external-global-plugin:react"(exports, module) {
      module.exports = Spicetify.React;
    }
  });

  // src/app.tsx
  var import_react8 = __toESM(require_react());

  // src/JamContext.tsx
  var import_react = __toESM(require_react());

  // src/spotify/player.ts
  var fmtImg = (u) => {
    if (!u)
      return "";
    if (u.startsWith("https://"))
      return u;
    if (u.startsWith("spotify:image:"))
      return `https://i.scdn.co/image/${u.slice(14)}`;
    return "";
  };
  var fetchUserAsync = async () => {
    try {
      const user = await Spicetify.Platform?.UserAPI?.getUser();
      if (user?.displayName) {
        return {
          name: user.displayName,
          image: fmtImg(user.images?.[0]?.url || user.images?.[0] || "")
        };
      }
    } catch {
    }
    try {
      const res = await Spicetify.CosmosAsync.get("sp://identity/v1/profile");
      if (res?.displayName || res?.name) {
        return {
          name: res.displayName || res.name,
          image: fmtImg(res.imageUrl || res.image || "")
        };
      }
    } catch {
    }
    const name = Spicetify.Username || document.querySelector('[data-testid="user-widget-name"]')?.textContent?.trim() || document.querySelector(".main-userWidget-displayName")?.textContent?.trim() || "Listener";
    return { name, image: "" };
  };
  var getTrack = () => {
    const t = Spicetify.Player.data?.item;
    if (!t)
      return null;
    const meta = t.metadata || {};
    return {
      title: t.name || meta.title || "Unknown",
      artist: t.artists?.[0]?.name || meta.artist_name || "Unknown",
      artUrl: fmtImg(meta.image_xlarge_url || meta.image_large_url || meta.image_url || t.images?.[0]?.url),
      uri: t.uri,
      uid: t.uid
    };
  };
  var extractTrack = (t) => {
    const data = t?.contextTrack || t?.track || t || {};
    const meta = data?.metadata || t?.metadata || {};
    const title = data.name || meta.name || meta.title || t.name || "?";
    const artist = data.artists?.[0]?.name || meta.artist_name || meta.album_artist || t.artist_name || "?";
    const artUrl = fmtImg(meta.image_xlarge_url || meta.image_large_url || meta.image_url || data.album?.images?.[0]?.url || t.imageUrl || meta.thumbnail_url);
    const uri = data.uri || t.uri || "";
    const uid = data.uid || t.uid || "";
    return { title, artist, artUrl, uri, uid };
  };
  var getQueue = async () => {
    try {
      let tracks = [];
      try {
        const res = await Spicetify.Platform?.PlayerAPI?.getQueue();
        if (res) {
          const queued = res.queued || [];
          const autoplay = res.autoplay || res.context || res.nextTracks || [];
          if (queued.length > 0 || autoplay.length > 0) {
            tracks = [...queued, ...autoplay];
          }
        }
      } catch {
      }
      if (!tracks || tracks.length === 0) {
        if (Spicetify.Player?.data?.next_tracks) {
          tracks = Spicetify.Player.data.next_tracks;
        }
      }
      if (!tracks || tracks.length === 0) {
        tracks = Spicetify.Queue?.nextTracks || [];
      }
      if (!tracks || tracks.length === 0) {
        try {
          const res = await Spicetify.CosmosAsync.get("sp://player/v2/main/queue");
          tracks = res?.next_tracks || res?.tracks || [];
        } catch {
        }
      }
      if (!tracks)
        return [];
      const seen = /* @__PURE__ */ new Set();
      return tracks.map(extractTrack).filter((t) => {
        if (!t.uri || seen.has(t.uid || t.uri))
          return false;
        if (t.title === "?" && t.artist === "?")
          return false;
        seen.add(t.uid || t.uri);
        return true;
      }).slice(0, 40);
    } catch {
      return [];
    }
  };

  // src/network/signaling.ts
  var SIGNAL_URL = "wss://jam-rtc.tanujairam.workers.dev";
  var sleep = (ms) => ({
    then(resolve) {
      setTimeout(resolve, ms);
    }
  });
  var SignalingClient = class {
    ws = null;
    clientId = null;
    onPeerJoinedCallback = null;
    onPeerJoined(callback) {
      this.onPeerJoinedCallback = callback;
    }
    connect(roomId, onMessage) {
      let openResolver = null;
      let errorRejecter = null;
      const ready = {
        then(resolve) {
          openResolver = resolve;
        },
        catch(reject) {
          errorRejecter = reject;
          return this;
        }
      };
      this.ws = new WebSocket(
        `${SIGNAL_URL}/room/${roomId}`
      );
      this.ws.onopen = () => {
        console.log(
          "[SIGNAL] Connected",
          roomId
        );
        openResolver?.();
      };
      this.ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(
            e.data
          );
          if (msg.type === "CONNECTED" && msg.clientId) {
            this.clientId = msg.clientId;
            console.log(
              "[SIGNAL] Client ID:",
              this.clientId
            );
            return;
          }
          if (msg.type === "PEER_JOINED" && msg.clientId) {
            console.log(
              "[SIGNAL] Peer joined:",
              msg.clientId
            );
            this.onPeerJoinedCallback?.(
              msg.clientId
            );
            return;
          }
          onMessage(msg);
        } catch (err) {
          console.error(
            "[SIGNAL] Parse error",
            err
          );
        }
      };
      this.ws.onerror = (err) => {
        errorRejecter?.(err);
      };
      return ready;
    }
    async waitForClientId() {
      while (!this.clientId) {
        await sleep(50);
      }
      return this.clientId;
    }
    send(data) {
      this.ws?.send(
        JSON.stringify(data)
      );
    }
    close() {
      this.ws?.close();
    }
  };

  // src/network/WebRTCPeerManager.ts
  var WebRTCPeerManager = class {
    connections = /* @__PURE__ */ new Map();
    peerConnections = /* @__PURE__ */ new Map();
    signaling = new SignalingClient();
    roomId;
    role;
    constructor(roomId, role) {
      this.roomId = roomId;
      this.role = role;
    }
    addConnection(id, conn, pc) {
      this.connections.set(id, conn);
      if (pc) {
        this.peerConnections.set(id, pc);
      }
    }
    getConnection(id) {
      return this.connections.get(id);
    }
    getPeerConnection(id) {
      return this.peerConnections.get(id);
    }
    removeConnection(id) {
      const conn = this.connections.get(id);
      if (conn) {
        conn.close();
        this.connections.delete(id);
      }
      const pc = this.peerConnections.get(id);
      if (pc) {
        pc.close();
        this.peerConnections.delete(id);
      }
    }
    connect(id) {
      const existing = this.connections.get(id);
      if (existing) {
        return existing;
      }
      throw new Error(`Connection not found: ${id}`);
    }
    destroy() {
      for (const conn of this.connections.values()) {
        conn.close();
      }
      for (const pc of this.peerConnections.values()) {
        pc.close();
      }
      this.connections.clear();
      this.peerConnections.clear();
      this.signaling.close();
    }
  };

  // src/network/webrtc.ts
  var ICE_SERVERS = [
    {
      urls: [
        "stun:stun.l.google.com:19302",
        "stun:stun.relay.metered.ca:80"
      ]
    },
    {
      urls: "turn:global.relay.metered.ca:80",
      username: "855afddb586aeb45ff1d8548",
      credential: "FPSBc6fiSuioTE5V"
    },
    {
      urls: "turn:global.relay.metered.ca:80?transport=tcp",
      username: "855afddb586aeb45ff1d8548",
      credential: "FPSBc6fiSuioTE5V"
    },
    {
      urls: "turn:global.relay.metered.ca:443",
      username: "855afddb586aeb45ff1d8548",
      credential: "FPSBc6fiSuioTE5V"
    },
    {
      urls: "turns:global.relay.metered.ca:443?transport=tcp",
      username: "855afddb586aeb45ff1d8548",
      credential: "FPSBc6fiSuioTE5V"
    }
  ];
  var DeferredWebRTCConnection = class {
    id;
    channel = null;
    openListeners = [];
    dataListeners = [];
    closeListeners = [];
    errorListeners = [];
    queuedMessages = [];
    closed = false;
    constructor(id) {
      this.id = id;
    }
    attach(channel) {
      if (this.channel || this.closed)
        return;
      this.channel = channel;
      this.channel.addEventListener("open", () => {
        this.openListeners.forEach((cb) => cb());
      });
      this.channel.addEventListener("message", (e) => {
        const data = JSON.parse(e.data);
        this.dataListeners.forEach((cb) => cb(data));
      });
      this.channel.addEventListener("close", () => {
        this.closeListeners.forEach((cb) => cb());
      });
      this.channel.addEventListener("error", (e) => {
        this.errorListeners.forEach((cb) => cb(e));
      });
      if (this.channel.readyState === "open") {
        setTimeout(() => {
          this.openListeners.forEach((cb) => cb());
        }, 0);
      }
      for (const msg of this.queuedMessages) {
        this.channel.send(JSON.stringify(msg));
      }
      this.queuedMessages = [];
    }
    get open() {
      return this.channel ? this.channel.readyState === "open" : false;
    }
    send(data) {
      if (this.channel && this.channel.readyState === "open") {
        this.channel.send(JSON.stringify(data));
      } else {
        this.queuedMessages.push(data);
      }
    }
    close() {
      this.closed = true;
      this.channel?.close();
    }
    onOpen(cb) {
      if (this.channel) {
        this.channel.addEventListener("open", cb);
      } else {
        this.openListeners.push(cb);
      }
    }
    onData(cb) {
      if (this.channel) {
        this.channel.addEventListener("message", (e) => cb(JSON.parse(e.data)));
      } else {
        this.dataListeners.push(cb);
      }
    }
    onClose(cb) {
      if (this.channel) {
        this.channel.addEventListener("close", cb);
      } else {
        this.closeListeners.push(cb);
      }
    }
    onError(cb) {
      if (this.channel) {
        this.channel.addEventListener("error", cb);
      } else {
        this.errorListeners.push(cb);
      }
    }
  };
  var WebRTCConnection = class {
    constructor(id, channel) {
      this.channel = channel;
      this.id = id;
    }
    id;
    get open() {
      return this.channel.readyState === "open";
    }
    send(data) {
      this.channel.send(JSON.stringify(data));
    }
    close() {
      this.channel.close();
    }
    onOpen(cb) {
      this.channel.addEventListener("open", cb);
    }
    onData(cb) {
      this.channel.addEventListener("message", (e) => {
        cb(JSON.parse(e.data));
      });
    }
    onClose(cb) {
      this.channel.addEventListener("close", cb);
    }
    onError(cb) {
      this.channel.addEventListener("error", cb);
    }
  };
  var createHost = async (roomId, onConnection) => {
    const manager = new WebRTCPeerManager(roomId, "host");
    const pendingIceCandidates = /* @__PURE__ */ new Map();
    const queueIceCandidate = (peerId, candidate) => {
      const queue = pendingIceCandidates.get(peerId) ?? [];
      queue.push(candidate);
      pendingIceCandidates.set(peerId, queue);
    };
    const flushIceCandidates = async (peerId, pc) => {
      const queued = pendingIceCandidates.get(peerId);
      if (!queued?.length)
        return;
      for (const candidate of queued) {
        await pc.addIceCandidate(candidate);
      }
      pendingIceCandidates.delete(peerId);
    };
    await manager.signaling.connect(
      roomId,
      async (msg) => {
        if (msg.sender === manager.signaling.clientId)
          return;
        if (msg.type === "answer") {
          console.log(
            "[HOST] Answer received from",
            msg.sender
          );
          const pc = manager.getPeerConnection(msg.sender);
          if (pc) {
            await pc.setRemoteDescription(msg.answer);
            console.log("[HOST] Remote description set");
            await flushIceCandidates(msg.sender, pc);
          }
        }
        if (msg.type === "candidate") {
          const pc = manager.getPeerConnection(msg.sender);
          if (!pc || !pc.remoteDescription) {
            queueIceCandidate(msg.sender, msg.candidate);
            return;
          }
          await pc.addIceCandidate(
            msg.candidate
          );
        }
        if (msg.type === "offer") {
          let pc = manager.getPeerConnection(msg.sender);
          if (!pc) {
            pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
            const pcRef = pc;
            pcRef.onconnectionstatechange = () => {
              console.log(
                "[HOST PC]",
                pcRef.connectionState
              );
            };
            pcRef.onicegatheringstatechange = () => {
              console.log(
                "[HOST GATHER]",
                pcRef.iceGatheringState
              );
            };
            pcRef.onicecandidateerror = (e) => {
              console.log(
                "[HOST ICE ERROR]",
                e
              );
            };
            pcRef.oniceconnectionstatechange = () => {
              console.log(
                "[HOST ICE STATE]",
                pcRef.iceConnectionState
              );
            };
            pcRef.ondatachannel = (e) => {
              e.channel.onopen = () => {
                console.log(
                  "[HOST] DataChannel OPEN",
                  msg.sender
                );
              };
              e.channel.onclose = () => {
                console.log(
                  "[HOST] DataChannel CLOSE",
                  msg.sender
                );
              };
              const conn = new WebRTCConnection(msg.sender, e.channel);
              manager.addConnection(msg.sender, conn, pcRef);
              onConnection(conn);
            };
            pcRef.onicecandidate = (e) => {
              if (!e.candidate) {
                console.log(
                  "[HOST ICE] COMPLETE"
                );
                return;
              }
              manager.signaling.send({
                sender: manager.signaling.clientId,
                target: msg.sender,
                type: "candidate",
                candidate: e.candidate
              });
            };
          }
          await pc.setRemoteDescription(msg.offer);
          await flushIceCandidates(msg.sender, pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          manager.signaling.send({
            sender: manager.signaling.clientId,
            target: msg.sender,
            type: "answer",
            answer
          });
        }
      }
    );
    await manager.signaling.waitForClientId();
    manager.signaling.onPeerJoined(async (peerId) => {
      console.log(
        "[HOST] Creating RTC for",
        peerId
      );
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pc.onconnectionstatechange = () => {
        console.log(
          "[HOST PC]",
          pc.connectionState
        );
      };
      pc.onicegatheringstatechange = () => {
        console.log(
          "[HOST GATHER]",
          pc.iceGatheringState
        );
      };
      pc.onicecandidateerror = (e) => {
        console.log(
          "[HOST ICE ERROR]",
          e
        );
      };
      pc.oniceconnectionstatechange = () => {
        console.log(
          "[HOST ICE STATE]",
          pc.iceConnectionState
        );
      };
      const channel = pc.createDataChannel("jam");
      channel.onopen = () => {
        console.log(
          "[HOST] DataChannel OPEN",
          peerId
        );
      };
      channel.onclose = () => {
        console.log(
          "[HOST] DataChannel CLOSE",
          peerId
        );
      };
      const conn = new WebRTCConnection(peerId, channel);
      manager.addConnection(peerId, conn, pc);
      onConnection(conn);
      pc.onicecandidate = (e) => {
        if (!e.candidate) {
          console.log(
            "[HOST ICE] COMPLETE"
          );
          return;
        }
        console.log(
          "[HOST ICE]",
          e.candidate.candidate
        );
        manager.signaling.send({
          sender: manager.signaling.clientId,
          target: peerId,
          type: "candidate",
          candidate: e.candidate
        });
      };
      console.log(
        "[HOST] Creating offer for",
        peerId
      );
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      console.log(
        "[HOST] Sending offer to",
        peerId
      );
      manager.signaling.send({
        sender: manager.signaling.clientId,
        target: peerId,
        type: "offer",
        offer
      });
    });
    return manager;
  };
  var joinHost = async (roomId, onConnection) => {
    const manager = new WebRTCPeerManager(roomId, "guest");
    const pendingIceCandidates = /* @__PURE__ */ new Map();
    let hostId = null;
    const queueIceCandidate = (peerId, candidate) => {
      const queue = pendingIceCandidates.get(peerId) ?? [];
      queue.push(candidate);
      pendingIceCandidates.set(peerId, queue);
    };
    const flushIceCandidates = async (peerId, pc) => {
      const queued = pendingIceCandidates.get(peerId);
      if (!queued?.length)
        return;
      for (const candidate of queued) {
        await pc.addIceCandidate(candidate);
      }
      pendingIceCandidates.delete(peerId);
    };
    const createGuestConnection = (id) => {
      const deferred = new DeferredWebRTCConnection(id);
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pc.onconnectionstatechange = () => {
        console.log(
          "[GUEST PC]",
          pc.connectionState
        );
      };
      pc.onicegatheringstatechange = () => {
        console.log(
          "[GUEST GATHER]",
          pc.iceGatheringState
        );
      };
      pc.onicecandidateerror = (e) => {
        console.log(
          "[GUEST ICE ERROR]",
          e
        );
      };
      pc.oniceconnectionstatechange = () => {
        console.log(
          "[GUEST ICE STATE]",
          pc.iceConnectionState
        );
      };
      manager.addConnection(id, deferred, pc);
      pc.onicecandidate = (e) => {
        if (!e.candidate) {
          console.log(
            "[GUEST ICE] COMPLETE"
          );
          return;
        }
        console.log(
          "[GUEST ICE]",
          e.candidate.candidate
        );
        manager.signaling.send({
          sender: manager.signaling.clientId,
          target: id,
          type: "candidate",
          candidate: e.candidate
        });
      };
      pc.ondatachannel = (e) => {
        console.log(
          "[GUEST] DataChannel received"
        );
        e.channel.onopen = () => {
          console.log(
            "[GUEST] DataChannel OPEN"
          );
        };
        e.channel.onclose = () => {
          console.log(
            "[GUEST] DataChannel CLOSE"
          );
        };
        deferred.attach(e.channel);
      };
      deferred.onClose(() => {
        manager.removeConnection(id);
      });
      onConnection(deferred);
      return deferred;
    };
    await manager.signaling.connect(
      roomId,
      async (msg) => {
        if (manager.signaling.clientId && msg.sender === manager.signaling.clientId)
          return;
        if (msg.type === "offer") {
          hostId = msg.sender;
          const peerId = msg.sender;
          if (!manager.getPeerConnection(peerId)) {
            createGuestConnection(peerId);
          }
          const pc = manager.getPeerConnection(peerId);
          if (!pc)
            return;
          console.log(
            "[GUEST] Offer from",
            peerId
          );
          await pc.setRemoteDescription(msg.offer);
          console.log("[GUEST] Remote description set");
          await flushIceCandidates(peerId, pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          console.log(
            "[GUEST] Sending answer"
          );
          manager.signaling.send({
            sender: manager.signaling.clientId,
            target: peerId,
            type: "answer",
            answer
          });
        }
        if (msg.type === "candidate") {
          const peerId = msg.sender;
          if (!hostId) {
            hostId = peerId;
          }
          if (peerId !== hostId)
            return;
          const pc = manager.getPeerConnection(peerId);
          if (!pc || !pc.remoteDescription) {
            queueIceCandidate(peerId, msg.candidate);
            return;
          }
          await pc.addIceCandidate(
            msg.candidate
          );
        }
      }
    );
    await manager.signaling.waitForClientId();
    return manager;
  };

  // src/network/peerManager.ts
  var setupConn = (conn, conns, onData2, onClose) => {
    conn.onOpen(() => {
      conns.current.set(conn.id, conn);
    });
    conn.onData((d) => {
      onData2(d, conn);
    });
    conn.onClose(() => {
      console.warn("[JAM] connection closed", conn.id);
      conns.current.delete(conn.id);
      onClose(conn.id);
    });
    conn.onError((e) => {
      console.error("[JAM] connection error", conn.id, e);
    });
  };
  var startJam = async (params) => {
    const retries = params.retries || 0;
    const me = await (params.userPromise.current || fetchUserAsync());
    params.cachedUser.current = me;
    const genId = () => Math.random().toString(36).substring(2, 8).toUpperCase();
    console.log("[HOST] Creating room...");
    const jamId = genId();
    const manager = await createHost(jamId, params.setupConn);
    params.setJamId(jamId);
    params.setIsHost(true);
    params.setConnected(true);
    params.setError(null);
    params.setHostName(me.name);
    params.setMembers([
      {
        id: "host",
        name: me.name,
        image: me.image,
        isHost: true
      }
    ]);
    const t = getTrack();
    if (t) {
      params.setNowPlaying(t);
    }
    params.setIsPlaying(Spicetify.Player.isPlaying());
    params.setProgress(Spicetify.Player.getProgress());
    params.setDuration(Spicetify.Player.getDuration());
    setTimeout(params.refreshQueue, 500);
    console.log("[HOST] Ready for connections");
    return manager;
  };
  var joinJam = async (params) => {
    const me = await (params.userPromise.current || fetchUserAsync());
    params.cachedUser.current = me;
    const cleanId = params.id.includes("jam=") ? params.id.split("jam=")[1] : params.id.trim();
    console.log("[GUEST] Join requested");
    console.log("[GUEST] User:", me.name);
    console.log("[GUEST] Room ID:", cleanId);
    const manager = await joinHost(cleanId, params.setupConn);
    params.setJamId(cleanId);
    params.setIsHost(false);
    params.setError(null);
    params.setMembers([
      {
        id: cleanId,
        name: "Host",
        isHost: true
      },
      {
        id: "me",
        name: me.name,
        image: me.image
      }
    ]);
    return manager;
  };

  // src/utils/sync.ts
  function predictPosition(position, timestamp, playing) {
    if (!playing) {
      return Math.max(0, position);
    }
    return Math.max(
      0,
      position + (Date.now() - timestamp)
    );
  }
  function calculateDrift(localPosition, remotePosition) {
    return remotePosition - localPosition;
  }
  function shouldHardSeek(drift) {
    return Math.abs(drift) > 750;
  }

  // src/network/messageHandlers.ts
  var consumeQueue = (uri, deps) => {
    const idx = deps.queueRef.current.findIndex(
      (t) => t.uri === uri
    );
    if (idx < 0)
      return;
    const q = deps.queueRef.current.slice(idx + 1);
    deps.queueRef.current = q;
    deps.setQueue(q);
  };
  var handleJoin = async (d, conn, deps) => {
    const r = deps.refs.current;
    if (!r.isHost)
      return;
    deps.memberRegistry.current.set(conn.id, { name: d.name || "Listener", image: d.image || "" });
    const all = deps.buildMembers();
    deps.setMembers(all);
    conn.send({
      type: "INIT",
      np: getTrack(),
      queue: await getQueue(),
      host: deps.cachedUser.current.name,
      gc: r.guestControls,
      playing: Spicetify.Player.isPlaying(),
      members: all,
      progress: Spicetify.Player.getProgress(),
      duration: Spicetify.Player.getDuration()
    });
    if (Spicetify.Player.data?.item) {
      conn.send({
        type: "PLAY",
        uri: Spicetify.Player.data.item.uri,
        pos: Spicetify.Player.getProgress(),
        ts: Date.now(),
        paused: !Spicetify.Player.isPlaying()
      });
    }
    deps.broadcast({ type: "MEMBERS", members: all });
  };
  var handleInit = (d, deps) => {
    if (d.np) {
      deps.setNowPlaying(d.np);
      deps.refs.current.targetUri = d.np.uri;
    }
    if (d.queue) {
      let q = d.queue;
      if (d.np?.uri) {
        const idx = q.findIndex(
          (t) => t.uri === d.np.uri
        );
        if (idx >= 0) {
          q = q.slice(idx + 1);
        }
      }
      deps.queueRef.current = q;
      deps.setQueue(q);
    }
    if (d.host)
      deps.setHostName(d.host);
    if (d.members)
      deps.setMembers(d.members);
    if (d.gc !== void 0)
      deps.setGuestControls(d.gc);
    if (d.playing !== void 0)
      deps.setIsPlaying(d.playing);
    if (d.progress !== void 0)
      deps.setProgress(d.progress);
    if (d.duration !== void 0)
      deps.setDuration(d.duration);
  };
  var handleMembers = (d, deps) => {
    deps.setMembers(d.members);
  };
  var handleGCtrl = (d, deps) => {
    deps.setGuestControls(d.on);
  };
  var handleCmd = (d, conn, deps) => {
    const r = deps.refs.current;
    if (!r.isHost || !r.guestControls)
      return;
    if (Date.now() - (deps.cmdThrottle.current.get(conn.id) || 0) < 500)
      return;
    deps.cmdThrottle.current.set(conn.id, Date.now());
    if (d.a === "play")
      Spicetify.Player.play();
    else if (d.a === "pause")
      Spicetify.Player.pause();
    else if (d.a === "next")
      Spicetify.Player.next();
    else if (d.a === "back")
      Spicetify.Player.back();
    else if (d.a === "seek")
      Spicetify.Player.seek(d.pos);
    else if (d.a === "playuri") {
      consumeQueue(d.uri, deps);
      deps.pendingQueueRestore.current = deps.queueRef.current;
      deps.broadcast({ type: "Q", queue: deps.queueRef.current });
      deps.refs.current.targetUri = d.uri;
      Spicetify.Player.playUri(d.uri);
    }
  };
  var handleKick = (d, deps) => {
    deps.leaveJam();
    deps.setError("Removed from Jam");
    Spicetify.showNotification("Kicked from Jam");
  };
  var handlePlay = async (d, deps) => {
    console.log(
      "[GUEST] PLAY",
      d.uri,
      d.pos,
      d.paused,
      Date.now()
    );
    const r = deps.refs.current;
    if (!r.isHost) {
      const curUri = Spicetify.Player.data?.item?.uri;
      const trackChanged = curUri !== d.uri;
      r.targetUri = d.uri;
      if (trackChanged) {
        deps.setProgress(0);
        consumeQueue(d.uri, deps);
      }
      if (d.paused) {
        if (trackChanged) {
          r.ignoreSync = true;
          deps.setIsPlaying(false);
          Spicetify.Player.playUri(d.uri).then(() => {
            setTimeout(() => {
              Spicetify.Player.pause();
              r.ignoreSync = false;
            }, 150);
          }).catch(() => {
            r.ignoreSync = false;
          });
        } else {
          Spicetify.Player.pause();
          deps.setIsPlaying(false);
        }
      } else if (!trackChanged) {
        const predicted = predictPosition(d.pos, d.ts, !d.paused);
        const localProgress = Spicetify.Player.getProgress();
        const drift = calculateDrift(localProgress, predicted);
        if (shouldHardSeek(drift)) {
          ;
          Spicetify.Player.seek(predicted);
        }
        deps.setIsPlaying(!d.paused);
        if (d.paused) {
          if (Spicetify.Player.isPlaying()) {
            Spicetify.Player.pause();
          }
        } else {
          if (!Spicetify.Player.isPlaying()) {
            Spicetify.Player.play();
          }
        }
      } else {
        r.ignoreSync = true;
        deps.setIsPlaying(true);
        Spicetify.Player.playUri(d.uri).then(() => {
          const seekMs = predictPosition(d.pos, d.ts, !d.paused);
          const sid = setTimeout(() => {
            try {
              const current = Spicetify.Player.getProgress();
              const drift = calculateDrift(current, seekMs);
              if (shouldHardSeek(drift)) {
                ;
                Spicetify.Player.seek(seekMs);
              }
            } finally {
              r.ignoreSync = false;
            }
          }, Math.max(300, Date.now() - d.ts));
          deps.seekTimers.current.push(sid);
        }).catch(() => {
          r.ignoreSync = false;
        });
      }
    }
    if (d.np)
      deps.setNowPlaying(d.np);
  };
  var handlePause = (d, deps) => {
    if (!deps.refs.current.isHost) {
      ;
      Spicetify.Player.pause();
      deps.setIsPlaying(false);
    }
  };
  var handleSeek = (d, deps) => {
    if (!deps.refs.current.isHost) {
      const predicted = predictPosition(d.pos, d.ts, !d.paused);
      const localProgress = Spicetify.Player.getProgress();
      const drift = calculateDrift(localProgress, predicted);
      if (shouldHardSeek(drift)) {
        ;
        Spicetify.Player.seek(predicted);
      }
    }
  };
  var handlePs = (d, deps) => {
    if (!deps.refs.current.isHost) {
      deps.setIsPlaying(d.p);
      if (d.pos !== void 0)
        deps.setProgress(d.pos);
      if (d.dur !== void 0)
        deps.setDuration(d.dur);
    }
  };
  var handleAddQ = (d, deps) => {
    if (deps.refs.current.isHost)
      deps.addToQueue(d.uri);
  };
  var handleRmQ = (d, deps) => {
    if (deps.refs.current.isHost)
      deps.removeFromQueue(d.uri, d.uid);
  };
  var handleQ = (d, deps) => {
    deps.queueRef.current = d.queue;
    deps.setQueue(d.queue);
  };
  var handlePing = (d, conn, deps) => {
    conn.send({ type: "PONG", ts: d.ts });
  };
  var handlePong = (d, deps) => {
    deps.setPing(Date.now() - d.ts);
  };
  var handleSync = async (d, conn, deps) => {
    if (deps.refs.current.isHost && Spicetify.Player.data?.item) {
      conn.send({
        type: "Q",
        queue: await getQueue()
      });
    }
  };
  var onData = async (d, conn, deps) => {
    const r = deps.refs.current;
    if (!r.isHost)
      deps.lastHostMsg.current = Date.now();
    switch (d.type) {
      case "JOIN":
        return handleJoin(d, conn, deps);
      case "INIT":
        return handleInit(d, deps);
      case "MEMBERS":
        return handleMembers(d, deps);
      case "GCTRL":
        return handleGCtrl(d, deps);
      case "CMD":
        return handleCmd(d, conn, deps);
      case "KICK":
        return handleKick(d, deps);
      case "PLAY":
        return handlePlay(d, deps);
      case "PAUSE":
        return handlePause(d, deps);
      case "SEEK":
        return handleSeek(d, deps);
      case "PS":
        return handlePs(d, deps);
      case "ADD_Q":
        return handleAddQ(d, deps);
      case "RM_Q":
        return handleRmQ(d, deps);
      case "Q":
        return handleQ(d, deps);
      case "PING":
        return handlePing(d, conn, deps);
      case "PONG":
        return handlePong(d, deps);
      case "SYNC":
        return await handleSync(d, conn, deps);
    }
  };

  // src/JamContext.tsx
  var Ctx = (0, import_react.createContext)(void 0);
  var JamProvider = ({ children }) => {
    const [isHost, setIsHost] = (0, import_react.useState)(false);
    const [jamId, setJamId] = (0, import_react.useState)("");
    const [members, setMembers] = (0, import_react.useState)([]);
    const [connected, setConnected] = (0, import_react.useState)(false);
    const [error, setError] = (0, import_react.useState)(null);
    const [nowPlaying, setNowPlaying] = (0, import_react.useState)(null);
    const [hostName, setHostName] = (0, import_react.useState)("Host");
    const [queue, setQueue] = (0, import_react.useState)([]);
    const [guestControls, setGuestControls] = (0, import_react.useState)(false);
    const [isPlaying, setIsPlaying] = (0, import_react.useState)(false);
    const [progress, setProgress] = (0, import_react.useState)(0);
    const [duration, setDuration] = (0, import_react.useState)(0);
    const [ping, setPing] = (0, import_react.useState)(-1);
    const peerRef = (0, import_react.useRef)(null);
    const conns = (0, import_react.useRef)(/* @__PURE__ */ new Map());
    const memberRegistry = (0, import_react.useRef)(/* @__PURE__ */ new Map());
    const cachedUser = (0, import_react.useRef)({ name: "Listener", image: "" });
    const userPromise = (0, import_react.useRef)(null);
    const refs = (0, import_react.useRef)({ isHost: false, connected: false, guestControls: false, jamId: "", targetUri: null, ignoreSync: false, isPlaying: false, forcingPause: false });
    const cmdThrottle = (0, import_react.useRef)(/* @__PURE__ */ new Map());
    const lastHostMsg = (0, import_react.useRef)(0);
    const reconnectAttempt = (0, import_react.useRef)(0);
    const reconnectTimer = (0, import_react.useRef)(null);
    const songDebounce = (0, import_react.useRef)(null);
    const seekTimers = (0, import_react.useRef)([]);
    const ctxMenuItem = (0, import_react.useRef)(null);
    const pendingQueueRestore = (0, import_react.useRef)([]);
    const queueRef = (0, import_react.useRef)([]);
    (0, import_react.useEffect)(() => {
      queueRef.current = queue;
    }, [queue]);
    (0, import_react.useEffect)(() => {
      refs.current.isHost = isHost;
    }, [isHost]);
    (0, import_react.useEffect)(() => {
      refs.current.connected = connected;
    }, [connected]);
    (0, import_react.useEffect)(() => {
      refs.current.guestControls = guestControls;
    }, [guestControls]);
    (0, import_react.useEffect)(() => {
      refs.current.jamId = jamId;
    }, [jamId]);
    (0, import_react.useEffect)(() => {
      refs.current.isPlaying = isPlaying;
    }, [isPlaying]);
    (0, import_react.useEffect)(() => {
      userPromise.current = fetchUserAsync();
      userPromise.current.then((u) => {
        cachedUser.current = u;
      });
    }, []);
    const broadcast = (0, import_react.useCallback)((d) => conns.current.forEach((c) => c.open && c.send(d)), []);
    const hostConn = (0, import_react.useCallback)(() => conns.current.get(refs.current.jamId) || Array.from(conns.current.values())[0], []);
    const buildMembers = (0, import_react.useCallback)(() => {
      const me = cachedUser.current;
      const result = [];
      if (refs.current.isHost) {
        result.push({ id: "host", name: me.name, image: me.image, isHost: true });
        conns.current.forEach((_, pid) => {
          const m = memberRegistry.current.get(pid);
          result.push({ id: pid, name: m?.name || "Listener", image: m?.image || "" });
        });
      }
      return result;
    }, []);
    const refreshQueue = (0, import_react.useCallback)(async () => {
      if (!refs.current.isHost)
        return;
      const q = await getQueue();
      setQueue(q);
      broadcast({ type: "Q", queue: q });
    }, [broadcast]);
    const addToQueue = (0, import_react.useCallback)(async (uris) => {
      const uriArray = Array.isArray(uris) ? uris : [uris];
      if (refs.current.isHost) {
        try {
          await Spicetify.addToQueue(uriArray.map((uri) => ({ uri })));
          Spicetify.showNotification(uriArray.length > 1 ? `Added ${uriArray.length} tracks!` : "Added!");
          setTimeout(refreshQueue, 1500);
        } catch {
          Spicetify.showNotification("Failed to add to queue", true);
        }
      } else {
        const c = hostConn();
        if (c?.open) {
          uriArray.forEach((uri) => c.send({ type: "ADD_Q", uri }));
          Spicetify.showNotification(uriArray.length > 1 ? `Requested ${uriArray.length} tracks!` : "Requested!");
        }
      }
    }, [refreshQueue, hostConn]);
    const removeFromQueue = (0, import_react.useCallback)(async (uri, uid) => {
      if (refs.current.isHost) {
        try {
          await Spicetify.removeFromQueue([{ uri, uid }]);
          setTimeout(refreshQueue, 500);
        } catch {
          setTimeout(refreshQueue, 800);
        }
      } else {
        const c = hostConn();
        if (c?.open)
          c.send({ type: "RM_Q", uri, uid });
      }
    }, [refreshQueue, hostConn]);
    const moveInQueue = (0, import_react.useCallback)((from, to) => {
      setQueue((p) => {
        const u = [...p];
        const [m] = u.splice(from, 1);
        u.splice(to, 0, m);
        queueRef.current = u;
        broadcast({ type: "Q", queue: u });
        return u;
      });
    }, [broadcast]);
    const seekTo = (0, import_react.useCallback)((ms) => {
      if (refs.current.isHost) {
        Spicetify.Player.seek(ms);
        broadcast({ type: "SEEK", pos: ms, ts: Date.now() });
      } else if (refs.current.guestControls) {
        const c = hostConn();
        if (c?.open)
          c.send({ type: "CMD", a: "seek", pos: ms });
      }
    }, [broadcast, hostConn]);
    const consumeLocalQueue = (0, import_react.useCallback)(
      (uri) => {
        const idx = queueRef.current.findIndex((t) => t.uri === uri);
        if (idx < 0)
          return;
        const q = queueRef.current.slice(idx + 1);
        pendingQueueRestore.current = q;
        queueRef.current = q;
        setQueue(q);
        broadcast({
          type: "Q",
          queue: q
        });
      },
      [broadcast]
    );
    const jumpToTrack = (0, import_react.useCallback)((uri) => {
      if (refs.current.isHost) {
        refs.current.targetUri = uri;
        consumeLocalQueue(uri);
        Spicetify.Player.playUri(uri);
      } else if (refs.current.guestControls) {
        const c = hostConn();
        if (c?.open)
          c.send({ type: "CMD", a: "playuri", uri });
      }
    }, [hostConn, consumeLocalQueue]);
    const toggleGuestControls = () => {
      if (!refs.current.isHost)
        return;
      const v = !guestControls;
      setGuestControls(v);
      broadcast({ type: "GCTRL", on: v });
    };
    const play = () => {
      if (refs.current.isHost) {
        Spicetify.Player.play();
      } else if (refs.current.guestControls) {
        const c = hostConn();
        if (c?.open)
          c.send({ type: "CMD", a: "play" });
      }
    };
    const pause = () => {
      if (refs.current.isHost) {
        Spicetify.Player.pause();
      } else if (refs.current.guestControls) {
        const c = hostConn();
        if (c?.open)
          c.send({ type: "CMD", a: "pause" });
      }
    };
    const next = () => {
      if (refs.current.isHost)
        Spicetify.Player.next();
      else if (refs.current.guestControls) {
        const c = hostConn();
        if (c?.open)
          c.send({ type: "CMD", a: "next" });
      }
    };
    const prev = () => {
      if (refs.current.isHost)
        Spicetify.Player.back();
      else if (refs.current.guestControls) {
        const c = hostConn();
        if (c?.open)
          c.send({ type: "CMD", a: "back" });
      }
    };
    const requestSync = () => {
      if (!refs.current.isHost) {
        const c = hostConn();
        if (c?.open)
          c.send({ type: "SYNC" });
      }
    };
    const leaveJam = (0, import_react.useCallback)(() => {
      conns.current.forEach((c) => c.close());
      conns.current.clear();
      memberRegistry.current.clear();
      peerRef.current?.destroy();
      peerRef.current = null;
      setConnected(false);
      setJamId("");
      setIsHost(false);
      refs.current.isHost = false;
      refs.current.connected = false;
      refs.current.guestControls = false;
      refs.current.ignoreSync = false;
      refs.current.forcingPause = false;
      refs.current.targetUri = null;
      setMembers([]);
      setQueue([]);
      setNowPlaying(null);
      setGuestControls(false);
      setHostName("Host");
      refs.current.targetUri = null;
      setPing(-1);
      reconnectAttempt.current = 0;
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      if (songDebounce.current) {
        clearTimeout(songDebounce.current);
        songDebounce.current = null;
      }
      seekTimers.current.forEach(clearTimeout);
      seekTimers.current = [];
      cmdThrottle.current.clear();
      pendingQueueRestore.current = [];
    }, []);
    const kickMember = (id) => {
      if (!refs.current.isHost)
        return;
      const c = conns.current.get(id);
      if (c) {
        c.send({ type: "KICK" });
        setTimeout(() => c.close(), 500);
        conns.current.delete(id);
        memberRegistry.current.delete(id);
        setMembers(buildMembers());
      }
    };
    const onData2 = (0, import_react.useCallback)(async (d, conn) => {
      await onData(d, conn, {
        refs,
        lastHostMsg,
        memberRegistry,
        cachedUser,
        seekTimers,
        buildMembers,
        addToQueue,
        removeFromQueue,
        broadcast,
        setMembers,
        setQueue,
        setNowPlaying,
        setHostName,
        setGuestControls,
        setIsPlaying,
        setProgress,
        setDuration,
        setPing,
        setError,
        leaveJam,
        cmdThrottle,
        queueRef,
        pendingQueueRestore
      });
    }, [buildMembers, addToQueue, removeFromQueue, broadcast, leaveJam]);
    const setupConn2 = (0, import_react.useCallback)((conn) => {
      setupConn(conn, conns, onData2, (peerId) => {
        memberRegistry.current.delete(peerId);
        setMembers(buildMembers());
      });
      conn.onOpen(() => {
        if (refs.current.isHost) {
          setMembers(buildMembers());
        } else {
          refs.current.connected = true;
          setConnected(true);
          const me = cachedUser.current;
          conn.send({
            type: "JOIN",
            name: me.name,
            image: me.image
          });
        }
      });
    }, [onData2, buildMembers]);
    const startJam2 = (0, import_react.useCallback)(async (retries = 0) => {
      if (refs.current.connected)
        leaveJam();
      refs.current.isHost = true;
      refs.current.connected = true;
      setIsHost(true);
      setConnected(true);
      const p = await startJam({
        retries,
        userPromise,
        cachedUser,
        setJamId,
        setIsHost,
        setConnected,
        setError,
        setHostName,
        setMembers,
        setNowPlaying,
        setIsPlaying,
        setProgress,
        setDuration,
        refreshQueue,
        setupConn: setupConn2
      });
      peerRef.current = p;
    }, [leaveJam, refreshQueue, setupConn2]);
    const joinJam2 = (0, import_react.useCallback)(async (id) => {
      if (refs.current.connected) {
        leaveJam();
      }
      const p = await joinJam({
        id,
        userPromise,
        cachedUser,
        conns,
        setJamId,
        setIsHost,
        setConnected,
        setError,
        setMembers,
        leaveJam,
        reconnectAttempt,
        reconnectTimer,
        setupConn: setupConn2,
        onData: onData2
      });
      peerRef.current = p;
    }, [leaveJam, setupConn2, onData2]);
    (0, import_react.useEffect)(() => {
      const id = setInterval(() => {
        if (refs.current.isHost) {
          try {
            setProgress(Spicetify.Player.getProgress());
            const d = Spicetify.Player.getDuration();
            if (d !== duration) {
              setDuration(d);
            }
          } catch {
          }
        } else if (refs.current.connected) {
          try {
            setProgress(Spicetify.Player.getProgress());
            setDuration(Spicetify.Player.getDuration());
          } catch {
          }
          const c = hostConn();
          if (c?.open)
            c.send({ type: "PING", ts: Date.now() });
          if (lastHostMsg.current > 0 && Date.now() - lastHostMsg.current > 1e4) {
            setError("Connection lost - trying to reconnect...");
            lastHostMsg.current = 0;
            if (reconnectAttempt.current < 3) {
              reconnectAttempt.current++;
              reconnectTimer.current = setTimeout(() => {
                if (!peerRef.current || !refs.current.jamId)
                  return;
                const newConn = peerRef.current.connect(refs.current.jamId);
                setupConn2(newConn);
                conns.current.set(refs.current.jamId, newConn);
                refs.current.connected = true;
                setConnected(true);
                setError(null);
                reconnectAttempt.current = 0;
                reconnectTimer.current = null;
              }, reconnectAttempt.current * 2e3);
            } else {
              leaveJam();
              setError("Lost connection to host");
            }
          }
          try {
            const localPlaying = Spicetify.Player.isPlaying();
            if (localPlaying !== refs.current.isPlaying && !refs.current.isHost) {
              const c2 = hostConn();
              if (c2?.open)
                c2.send({ type: "SYNC" });
            }
          } catch {
          }
        }
      }, 1e3);
      return () => clearInterval(id);
    }, [hostConn, leaveJam]);
    (0, import_react.useEffect)(() => {
      if (connected) {
        Spicetify.showNotification("\u2705 Jam Connected");
      }
    }, [connected]);
    (0, import_react.useEffect)(() => {
      if (!connected)
        return;
      const onSong = () => {
        if (songDebounce.current)
          clearTimeout(songDebounce.current);
        songDebounce.current = setTimeout(() => {
          const uri = Spicetify.Player.data?.item?.uri;
          if (refs.current.isHost) {
            console.log(
              "[HOST] Song change",
              {
                uri,
                playing: Spicetify.Player.isPlaying(),
                time: Date.now()
              }
            );
            const t = getTrack();
            if (t)
              setNowPlaying(t);
            refs.current.targetUri = uri || null;
            const hostPaused = !Spicetify.Player.isPlaying();
            broadcast({
              type: "PLAY",
              uri: uri || "",
              pos: Spicetify.Player.getProgress(),
              ts: Date.now(),
              np: t,
              paused: hostPaused
            });
            if (pendingQueueRestore.current.length > 0) {
              const restore = pendingQueueRestore.current;
              pendingQueueRestore.current = [];
              (async () => {
                for (const tr of restore) {
                  if (tr.uri) {
                    try {
                      await Spicetify.addToQueue([{ uri: tr.uri }]);
                    } catch {
                    }
                  }
                }
                setTimeout(refreshQueue, 1e3);
              })();
            } else {
              setTimeout(refreshQueue, 600);
            }
          } else {
            if (refs.current.ignoreSync) {
              refs.current.ignoreSync = false;
              return;
            }
            if (uri && uri !== refs.current.targetUri && refs.current.targetUri) {
              if (refs.current.guestControls) {
                const c = hostConn();
                if (c?.open)
                  c.send({ type: "CMD", a: "playuri", uri });
              } else {
                console.log(
                  "[GUEST] Song change",
                  {
                    uri,
                    playing: Spicetify.Player.isPlaying(),
                    time: Date.now()
                  }
                );
                refs.current.ignoreSync = true;
                Spicetify.Player.playUri(refs.current.targetUri).catch(() => {
                  refs.current.ignoreSync = false;
                });
                Spicetify.showNotification("\u{1F512} Locked to Jam");
              }
            }
          }
        }, 300);
      };
      const onPP = () => {
        if (refs.current.ignoreSync) {
          refs.current.ignoreSync = false;
          return;
        }
        const playing = Spicetify.Player.isPlaying();
        setIsPlaying(playing);
        if (refs.current.isHost) {
          const pos = Spicetify.Player.getProgress();
          const dur = Spicetify.Player.getDuration();
          broadcast({
            type: "PS",
            p: playing,
            pos,
            dur
          });
          if (!playing) {
            const currentUri = Spicetify.Player.data?.item?.uri;
            if (currentUri && currentUri === refs.current.targerUri) {
              broadcast({
                type: "PAUSE",
                pos,
                ts: Date.now()
              });
            }
          }
        } else {
          if (playing) {
            if (!refs.current.guestControls) {
              if (refs.current.forcingPause)
                return;
              refs.current.forcingPause = true;
              Spicetify.Player.pause();
              Spicetify.showNotification("\u{1F512} Only the host can resume playback");
              setTimeout(() => {
                refs.current.forcingPause = false;
              }, 500);
              const c = hostConn();
              if (c?.open) {
                c.send({ type: "SYNC" });
              }
            } else {
              const c = hostConn();
              if (c?.open) {
                c.send({
                  type: "CMD",
                  a: "play"
                });
              }
              const curUri = Spicetify.Player.data?.item?.uri;
              if (refs.current.targetUri && curUri && curUri !== refs.current.targetUri) {
                refs.current.ignoreSync = true;
                Spicetify.Player.playUri(
                  refs.current.targetUri
                ).catch(() => {
                  refs.current.ignoreSync = false;
                });
                Spicetify.showNotification("\u{1F512} Locked to Jam");
              }
            }
          } else if (refs.current.guestControls) {
            const c = hostConn();
            if (c?.open) {
              c.send({
                type: "CMD",
                a: "pause"
              });
            }
          }
        }
      };
      Spicetify.Player.addEventListener("songchange", onSong);
      Spicetify.Player.addEventListener("onplaypause", onPP);
      let qi = refs.current.isHost ? setInterval(refreshQueue, 5e3) : null;
      let driftI = !refs.current.isHost ? setInterval(() => {
        const c = hostConn();
        if (c?.open)
          c.send({ type: "SYNC" });
      }, 15e3) : null;
      try {
        if (ctxMenuItem.current) {
          try {
            ctxMenuItem.current.deregister();
          } catch {
          }
        }
        ctxMenuItem.current = new Spicetify.ContextMenu.Item(
          "Add to Jam",
          (uris) => addToQueue(uris),
          () => refs.current.connected,
          "plus2px"
        );
        ctxMenuItem.current.register();
      } catch {
      }
      return () => {
        Spicetify.Player.removeEventListener("songchange", onSong);
        Spicetify.Player.removeEventListener("onplaypause", onPP);
        if (qi)
          clearInterval(qi);
        if (driftI)
          clearInterval(driftI);
        try {
          ctxMenuItem.current?.deregister();
        } catch {
        }
      };
    }, [connected, isHost, broadcast, refreshQueue, addToQueue, hostConn]);
    (0, import_react.useEffect)(() => {
      const hash = window.location.hash.slice(1);
      if (hash.startsWith("jam=")) {
        const id = hash.split("=")[1];
        if (id && !refs.current.connected)
          joinJam2(id);
      }
    }, [joinJam2]);
    return /* @__PURE__ */ import_react.default.createElement(Ctx.Provider, {
      value: {
        isHost,
        jamId,
        members,
        connected,
        error,
        nowPlaying,
        hostName,
        queue,
        guestControls,
        isPlaying,
        progress,
        duration,
        ping,
        startJam: startJam2,
        joinJam: joinJam2,
        leaveJam,
        addToQueue,
        removeFromQueue,
        moveInQueue,
        requestSync,
        jumpToTrack,
        seekTo,
        kickMember,
        toggleGuestControls,
        play,
        pause,
        next,
        prev
      }
    }, children);
  };
  var useJam = () => {
    const c = (0, import_react.useContext)(Ctx);
    if (!c)
      throw new Error("useJam must be inside JamProvider");
    return c;
  };

  // src/components/JamMenu.tsx
  var import_react7 = __toESM(require_react());

  // src/components/RoomCodeInput.tsx
  var import_react2 = __toESM(require_react());
  var ROOM_CODE_LENGTH = 6;
  var VALID_CHAR = /^[A-Z0-9]$/;
  var normalize = (value) => value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, ROOM_CODE_LENGTH);
  var RoomCodeInput = ({ value, onChange, disabled = false, autoFocus = false }) => {
    const normalizedValue = (0, import_react2.useMemo)(() => normalize(value), [value]);
    const chars = (0, import_react2.useMemo)(
      () => Array.from({ length: ROOM_CODE_LENGTH }, (_, index) => normalizedValue[index] || ""),
      [normalizedValue]
    );
    const inputRefs = (0, import_react2.useRef)(Array(ROOM_CODE_LENGTH).fill(null));
    (0, import_react2.useEffect)(() => {
      if (autoFocus && !disabled) {
        inputRefs.current[0]?.focus();
      }
    }, [autoFocus, disabled]);
    const updateCode = (nextChars, focusIndex) => {
      const nextCode = nextChars.join("").replace(/\s+$/g, "");
      onChange(nextCode);
      if (typeof focusIndex === "number") {
        requestAnimationFrame(() => {
          const clamped = Math.max(0, Math.min(ROOM_CODE_LENGTH - 1, focusIndex));
          inputRefs.current[clamped]?.focus();
        });
      }
    };
    const focusCell = (index) => {
      const safeIndex = Math.max(0, Math.min(ROOM_CODE_LENGTH - 1, index));
      inputRefs.current[safeIndex]?.focus();
    };
    const handleChange = (index) => (event) => {
      if (disabled)
        return;
      const raw = event.target.value.toUpperCase();
      const filtered = raw.replace(/[^A-Z0-9]/g, "");
      const nextChars = [...chars];
      if (!filtered) {
        nextChars[index] = "";
        updateCode(nextChars);
        return;
      }
      let writeIndex = index;
      for (const char of filtered) {
        if (writeIndex >= ROOM_CODE_LENGTH)
          break;
        nextChars[writeIndex] = char;
        writeIndex += 1;
      }
      updateCode(nextChars, writeIndex >= ROOM_CODE_LENGTH ? ROOM_CODE_LENGTH - 1 : writeIndex);
    };
    const handleKeyDown = (index) => (event) => {
      if (disabled)
        return;
      const key = event.key;
      if (key === "Backspace") {
        event.preventDefault();
        const nextChars = [...chars];
        if (nextChars[index]) {
          nextChars[index] = "";
          updateCode(nextChars, index);
        } else if (index > 0) {
          nextChars[index - 1] = "";
          updateCode(nextChars, index - 1);
        }
        return;
      }
      if (key === "Delete") {
        event.preventDefault();
        const nextChars = [...chars];
        nextChars[index] = "";
        updateCode(nextChars, index);
        return;
      }
      if (key === "ArrowLeft") {
        event.preventDefault();
        focusCell(index - 1);
        return;
      }
      if (key === "ArrowRight") {
        event.preventDefault();
        focusCell(index + 1);
        return;
      }
      if (key.length === 1 && !VALID_CHAR.test(key.toUpperCase())) {
        event.preventDefault();
      }
    };
    const handlePaste = (index) => (event) => {
      if (disabled)
        return;
      event.preventDefault();
      const pasted = event.clipboardData.getData("text");
      const normalized = normalize(pasted);
      if (!normalized)
        return;
      const nextChars = [...chars];
      let writeIndex = index;
      for (const char of normalized) {
        if (writeIndex >= ROOM_CODE_LENGTH)
          break;
        nextChars[writeIndex] = char;
        writeIndex += 1;
      }
      updateCode(nextChars, writeIndex >= ROOM_CODE_LENGTH ? ROOM_CODE_LENGTH - 1 : writeIndex);
    };
    return /* @__PURE__ */ import_react2.default.createElement("div", {
      className: "room-code-input",
      "aria-label": "Room code input"
    }, chars.map((character, index) => /* @__PURE__ */ import_react2.default.createElement("div", {
      key: index,
      className: "room-code-cell"
    }, /* @__PURE__ */ import_react2.default.createElement("input", {
      ref: (el) => {
        inputRefs.current[index] = el;
      },
      type: "text",
      inputMode: "text",
      autoComplete: "off",
      autoCorrect: "off",
      spellCheck: "false",
      maxLength: 1,
      value: character,
      disabled,
      onChange: handleChange(index),
      onKeyDown: handleKeyDown(index),
      onPaste: handlePaste(index),
      "aria-label": `Room code character ${index + 1}`
    }))));
  };
  var RoomCodeInput_default = RoomCodeInput;

  // src/utils/ui.ts
  var fmtTime = (ms) => {
    const s = Math.floor(ms / 1e3);
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  };
  var safeInitial = (name) => ((name || "?").trim()[0] || "?").toUpperCase();

  // src/icons.tsx
  var import_react6 = __toESM(require_react());

  // node_modules/lucide-react/dist/esm/createLucideIcon.mjs
  var import_react5 = __toESM(require_react(), 1);

  // node_modules/lucide-react/dist/esm/shared/src/utils/mergeClasses.mjs
  var mergeClasses = (...classes) => classes.filter((className, index, array) => {
    return Boolean(className) && className.trim() !== "" && array.indexOf(className) === index;
  }).join(" ").trim();

  // node_modules/lucide-react/dist/esm/shared/src/utils/toKebabCase.mjs
  var toKebabCase = (string) => string.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

  // node_modules/lucide-react/dist/esm/shared/src/utils/toCamelCase.mjs
  var toCamelCase = (string) => string.replace(
    /^([A-Z])|[\s-_]+(\w)/g,
    (match, p1, p2) => p2 ? p2.toUpperCase() : p1.toLowerCase()
  );

  // node_modules/lucide-react/dist/esm/shared/src/utils/toPascalCase.mjs
  var toPascalCase = (string) => {
    const camelCase = toCamelCase(string);
    return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
  };

  // node_modules/lucide-react/dist/esm/Icon.mjs
  var import_react4 = __toESM(require_react(), 1);

  // node_modules/lucide-react/dist/esm/defaultAttributes.mjs
  var defaultAttributes = {
    xmlns: "http://www.w3.org/2000/svg",
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round"
  };

  // node_modules/lucide-react/dist/esm/shared/src/utils/hasA11yProp.mjs
  var hasA11yProp = (props) => {
    for (const prop in props) {
      if (prop.startsWith("aria-") || prop === "role" || prop === "title") {
        return true;
      }
    }
    return false;
  };

  // node_modules/lucide-react/dist/esm/context.mjs
  var import_react3 = __toESM(require_react(), 1);
  "use client";
  var LucideContext = (0, import_react3.createContext)({});
  var useLucideContext = () => (0, import_react3.useContext)(LucideContext);

  // node_modules/lucide-react/dist/esm/Icon.mjs
  "use client";
  var Icon = (0, import_react4.forwardRef)(
    ({ color, size, strokeWidth, absoluteStrokeWidth, className = "", children, iconNode, ...rest }, ref) => {
      const {
        size: contextSize = 24,
        strokeWidth: contextStrokeWidth = 2,
        absoluteStrokeWidth: contextAbsoluteStrokeWidth = false,
        color: contextColor = "currentColor",
        className: contextClass = ""
      } = useLucideContext() ?? {};
      const calculatedStrokeWidth = absoluteStrokeWidth ?? contextAbsoluteStrokeWidth ? Number(strokeWidth ?? contextStrokeWidth) * 24 / Number(size ?? contextSize) : strokeWidth ?? contextStrokeWidth;
      return (0, import_react4.createElement)(
        "svg",
        {
          ref,
          ...defaultAttributes,
          width: size ?? contextSize ?? defaultAttributes.width,
          height: size ?? contextSize ?? defaultAttributes.height,
          stroke: color ?? contextColor,
          strokeWidth: calculatedStrokeWidth,
          className: mergeClasses("lucide", contextClass, className),
          ...!children && !hasA11yProp(rest) && { "aria-hidden": "true" },
          ...rest
        },
        [
          ...iconNode.map(([tag, attrs]) => (0, import_react4.createElement)(tag, attrs)),
          ...Array.isArray(children) ? children : [children]
        ]
      );
    }
  );

  // node_modules/lucide-react/dist/esm/createLucideIcon.mjs
  var createLucideIcon = (iconName, iconNode) => {
    const Component = (0, import_react5.forwardRef)(
      ({ className, ...props }, ref) => (0, import_react5.createElement)(Icon, {
        ref,
        iconNode,
        className: mergeClasses(
          `lucide-${toKebabCase(toPascalCase(iconName))}`,
          `lucide-${iconName}`,
          className
        ),
        ...props
      })
    );
    Component.displayName = toPascalCase(iconName);
    return Component;
  };

  // node_modules/lucide-react/dist/esm/icons/copy.mjs
  var __iconNode = [
    ["rect", { width: "14", height: "14", x: "8", y: "8", rx: "2", ry: "2", key: "17jyea" }],
    ["path", { d: "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2", key: "zix9uf" }]
  ];
  var Copy = createLucideIcon("copy", __iconNode);

  // node_modules/lucide-react/dist/esm/icons/grip-vertical.mjs
  var __iconNode2 = [
    ["circle", { cx: "9", cy: "12", r: "1", key: "1vctgf" }],
    ["circle", { cx: "9", cy: "5", r: "1", key: "hp0tcf" }],
    ["circle", { cx: "9", cy: "19", r: "1", key: "fkjjf6" }],
    ["circle", { cx: "15", cy: "12", r: "1", key: "1tmaij" }],
    ["circle", { cx: "15", cy: "5", r: "1", key: "19l28e" }],
    ["circle", { cx: "15", cy: "19", r: "1", key: "f4zoj3" }]
  ];
  var GripVertical = createLucideIcon("grip-vertical", __iconNode2);

  // node_modules/lucide-react/dist/esm/icons/list-music.mjs
  var __iconNode3 = [
    ["path", { d: "M16 5H3", key: "m91uny" }],
    ["path", { d: "M11 12H3", key: "51ecnj" }],
    ["path", { d: "M11 19H3", key: "zflm78" }],
    ["path", { d: "M21 16V5", key: "yxg4q8" }],
    ["circle", { cx: "18", cy: "16", r: "3", key: "1hluhg" }]
  ];
  var ListMusic = createLucideIcon("list-music", __iconNode3);

  // node_modules/lucide-react/dist/esm/icons/log-out.mjs
  var __iconNode4 = [
    ["path", { d: "m16 17 5-5-5-5", key: "1bji2h" }],
    ["path", { d: "M21 12H9", key: "dn1m92" }],
    ["path", { d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", key: "1uf3rs" }]
  ];
  var LogOut = createLucideIcon("log-out", __iconNode4);

  // node_modules/lucide-react/dist/esm/icons/music.mjs
  var __iconNode5 = [
    ["path", { d: "M9 18V5l12-2v13", key: "1jmyc2" }],
    ["circle", { cx: "6", cy: "18", r: "3", key: "fqmcym" }],
    ["circle", { cx: "18", cy: "16", r: "3", key: "1hluhg" }]
  ];
  var Music = createLucideIcon("music", __iconNode5);

  // node_modules/lucide-react/dist/esm/icons/pause.mjs
  var __iconNode6 = [
    ["rect", { x: "14", y: "3", width: "5", height: "18", rx: "1", key: "kaeet6" }],
    ["rect", { x: "5", y: "3", width: "5", height: "18", rx: "1", key: "1wsw3u" }]
  ];
  var Pause = createLucideIcon("pause", __iconNode6);

  // node_modules/lucide-react/dist/esm/icons/play.mjs
  var __iconNode7 = [
    [
      "path",
      {
        d: "M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z",
        key: "10ikf1"
      }
    ]
  ];
  var Play = createLucideIcon("play", __iconNode7);

  // node_modules/lucide-react/dist/esm/icons/settings.mjs
  var __iconNode8 = [
    [
      "path",
      {
        d: "M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915",
        key: "1i5ecw"
      }
    ],
    ["circle", { cx: "12", cy: "12", r: "3", key: "1v7zrd" }]
  ];
  var Settings = createLucideIcon("settings", __iconNode8);

  // node_modules/lucide-react/dist/esm/icons/skip-back.mjs
  var __iconNode9 = [
    [
      "path",
      {
        d: "M17.971 4.285A2 2 0 0 1 21 6v12a2 2 0 0 1-3.029 1.715l-9.997-5.998a2 2 0 0 1-.003-3.432z",
        key: "15892j"
      }
    ],
    ["path", { d: "M3 20V4", key: "1ptbpl" }]
  ];
  var SkipBack = createLucideIcon("skip-back", __iconNode9);

  // node_modules/lucide-react/dist/esm/icons/skip-forward.mjs
  var __iconNode10 = [
    ["path", { d: "M21 4v16", key: "7j8fe9" }],
    [
      "path",
      {
        d: "M6.029 4.285A2 2 0 0 0 3 6v12a2 2 0 0 0 3.029 1.715l9.997-5.998a2 2 0 0 0 .003-3.432z",
        key: "zs4d6"
      }
    ]
  ];
  var SkipForward = createLucideIcon("skip-forward", __iconNode10);

  // node_modules/lucide-react/dist/esm/icons/triangle-alert.mjs
  var __iconNode11 = [
    [
      "path",
      {
        d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",
        key: "wmoenq"
      }
    ],
    ["path", { d: "M12 9v4", key: "juzpu7" }],
    ["path", { d: "M12 17h.01", key: "p32p05" }]
  ];
  var TriangleAlert = createLucideIcon("triangle-alert", __iconNode11);

  // node_modules/lucide-react/dist/esm/icons/user-x.mjs
  var __iconNode12 = [
    ["path", { d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", key: "1yyitq" }],
    ["circle", { cx: "9", cy: "7", r: "4", key: "nufk8" }],
    ["line", { x1: "17", x2: "22", y1: "8", y2: "13", key: "3nzzx3" }],
    ["line", { x1: "22", x2: "17", y1: "8", y2: "13", key: "1swrse" }]
  ];
  var UserX = createLucideIcon("user-x", __iconNode12);

  // node_modules/lucide-react/dist/esm/icons/users.mjs
  var __iconNode13 = [
    ["path", { d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", key: "1yyitq" }],
    ["path", { d: "M16 3.128a4 4 0 0 1 0 7.744", key: "16gr8j" }],
    ["path", { d: "M22 21v-2a4 4 0 0 0-3-3.87", key: "kshegd" }],
    ["circle", { cx: "9", cy: "7", r: "4", key: "nufk8" }]
  ];
  var Users = createLucideIcon("users", __iconNode13);

  // node_modules/lucide-react/dist/esm/icons/x.mjs
  var __iconNode14 = [
    ["path", { d: "M18 6 6 18", key: "1bl5f8" }],
    ["path", { d: "m6 6 12 12", key: "d8bk6v" }]
  ];
  var X = createLucideIcon("x", __iconNode14);

  // src/icons.tsx
  var I = Object.freeze({
    close: /* @__PURE__ */ import_react6.default.createElement(X, {
      size: 18
    }),
    people: /* @__PURE__ */ import_react6.default.createElement(Users, {
      size: 15
    }),
    kick: /* @__PURE__ */ import_react6.default.createElement(UserX, {
      size: 14
    }),
    copy: /* @__PURE__ */ import_react6.default.createElement(Copy, {
      size: 14
    }),
    jam: /* @__PURE__ */ import_react6.default.createElement(Music, {
      size: 20
    }),
    leave: /* @__PURE__ */ import_react6.default.createElement(LogOut, {
      size: 14
    }),
    queue: /* @__PURE__ */ import_react6.default.createElement(ListMusic, {
      size: 15
    }),
    prev: /* @__PURE__ */ import_react6.default.createElement(SkipBack, {
      size: 20
    }),
    play: /* @__PURE__ */ import_react6.default.createElement(Play, {
      size: 28,
      fill: "currentColor"
    }),
    pause: /* @__PURE__ */ import_react6.default.createElement(Pause, {
      size: 28,
      fill: "currentColor"
    }),
    next: /* @__PURE__ */ import_react6.default.createElement(SkipForward, {
      size: 20
    }),
    playItem: /* @__PURE__ */ import_react6.default.createElement(Play, {
      size: 12,
      fill: "currentColor"
    }),
    settings: /* @__PURE__ */ import_react6.default.createElement(Settings, {
      size: 14
    }),
    warn: /* @__PURE__ */ import_react6.default.createElement(TriangleAlert, {
      size: 14
    }),
    drag: /* @__PURE__ */ import_react6.default.createElement(GripVertical, {
      size: 14,
      style: { opacity: 0.25 }
    })
  });

  // src/components/JamMenu.tsx
  var AVATAR_COLORS = [
    "linear-gradient(135deg,#1db954,#1ed760)",
    "linear-gradient(135deg,#e84444,#ff6b6b)",
    "linear-gradient(135deg,#4a90d9,#6eb5ff)",
    "linear-gradient(135deg,#f5a623,#ffc857)",
    "linear-gradient(135deg,#b24592,#f15f79)",
    "linear-gradient(135deg,#00c9ff,#92fe9d)"
  ];
  var JamMenu = ({ onClose }) => {
    const j = useJam();
    const [roomCode, setRoomCode] = (0, import_react7.useState)("");
    const [dragIdx, setDragIdx] = (0, import_react7.useState)(null);
    const [dragOverIdx, setDragOverIdx] = (0, import_react7.useState)(null);
    const copy = (text, msg) => {
      try {
        Spicetify.Platform.ClipboardAPI.copy(text);
      } catch {
        navigator.clipboard?.writeText(text);
      }
      Spicetify.showNotification(msg);
    };
    const handleSeek2 = (e) => {
      if (!j.isHost && !j.guestControls)
        return;
      const rect = e.currentTarget.getBoundingClientRect();
      const pct2 = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      j.seekTo(pct2 * j.duration);
    };
    const pct = j.duration > 0 ? j.progress / j.duration * 100 : 0;
    const canEdit = j.isHost || j.guestControls;
    const renderDisconnected = () => /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-root"
    }, /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-header"
    }, /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-header-left"
    }, /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-logo-icon"
    }, I.jam), /* @__PURE__ */ import_react7.default.createElement("div", null, /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-title"
    }, "Sync Party"), /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-subtitle"
    }, "Listen together"))), /* @__PURE__ */ import_react7.default.createElement("button", {
      className: "jam-icon-btn",
      onClick: onClose
    }, I.close)), /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-body"
    }, /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-hero"
    }, /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-hero-icon"
    }, I.jam), /* @__PURE__ */ import_react7.default.createElement("h2", {
      className: "jam-hero-title"
    }, "Start a new Jam"), /* @__PURE__ */ import_react7.default.createElement("p", {
      className: "jam-hero-desc"
    }, "Sync playback and share your queue with friends in real-time.")), /* @__PURE__ */ import_react7.default.createElement("button", {
      className: "jam-btn green full",
      onClick: j.startJam
    }, "Start a new Jam"), /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-divider"
    }, /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-divider-line"
    }), /* @__PURE__ */ import_react7.default.createElement("span", null, "Enter Room Code"), /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-divider-line"
    })), /* @__PURE__ */ import_react7.default.createElement(RoomCodeInput_default, {
      value: roomCode,
      onChange: setRoomCode,
      autoFocus: true,
      disabled: false
    }), /* @__PURE__ */ import_react7.default.createElement("button", {
      className: "jam-btn outline full jam-join-btn",
      onClick: () => j.joinJam(roomCode),
      disabled: !/^[A-Z0-9]{6}$/.test(roomCode)
    }, "Join Session"), j.error && /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-error"
    }, I.warn, " ", j.error)));
    const renderNowPlaying = () => j.nowPlaying ? /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-np-card"
    }, /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-np-art-wrap"
    }, j.nowPlaying.artUrl ? /* @__PURE__ */ import_react7.default.createElement("img", {
      className: "jam-np-art",
      src: j.nowPlaying.artUrl,
      alt: "",
      onError: (e) => {
        e.target.hidden = true;
      }
    }) : /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-np-art placeholder"
    })), /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-np-meta"
    }, /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-np-label"
    }, "NOW PLAYING"), /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-np-title"
    }, j.nowPlaying.title), /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-np-artist"
    }, j.nowPlaying.artist)), /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-progress-row"
    }, /* @__PURE__ */ import_react7.default.createElement("span", {
      className: "jam-time"
    }, fmtTime(j.progress)), /* @__PURE__ */ import_react7.default.createElement("div", {
      className: `jam-progress-rail ${canEdit ? "clickable" : "readonly"}`,
      onClick: handleSeek2
    }, /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-progress-fill",
      style: { width: `${pct}%` }
    }), /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-progress-dot",
      style: { left: `${pct}%` }
    })), /* @__PURE__ */ import_react7.default.createElement("span", {
      className: "jam-time"
    }, fmtTime(j.duration))), canEdit && /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-controls"
    }, /* @__PURE__ */ import_react7.default.createElement("button", {
      className: "jam-ctrl-btn",
      onClick: j.prev
    }, I.prev), /* @__PURE__ */ import_react7.default.createElement("button", {
      className: "jam-ctrl-btn main",
      onClick: j.isPlaying ? j.pause : j.play
    }, j.isPlaying ? I.pause : I.play), /* @__PURE__ */ import_react7.default.createElement("button", {
      className: "jam-ctrl-btn",
      onClick: j.next
    }, I.next))) : null;
    const renderSessionSettings = () => /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-section-card"
    }, /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-section-title"
    }, I.settings, " SESSION SETTINGS"), /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-setting-row"
    }, /* @__PURE__ */ import_react7.default.createElement("span", null, "Guest Playback Controls"), /* @__PURE__ */ import_react7.default.createElement("button", {
      className: `jam-toggle ${j.guestControls ? "on" : ""}`,
      onClick: j.toggleGuestControls,
      "aria-label": "Toggle guest playback controls",
      "aria-pressed": j.guestControls
    }, /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-toggle-knob"
    }))));
    const renderRoomCode = () => /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-section-card"
    }, /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-section-title"
    }, "Room Code"), /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-id-row"
    }, /* @__PURE__ */ import_react7.default.createElement("span", {
      className: "jam-id-code"
    }, j.jamId)), /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-share-row"
    }, /* @__PURE__ */ import_react7.default.createElement("button", {
      className: "jam-btn outline flex-1",
      onClick: () => copy(j.jamId, "Copied invite code!")
    }, I.copy, " Copy Code")));
    const renderQueue = () => j.queue.length > 0 ? /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-section-card"
    }, /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-section-title"
    }, I.queue, " UP NEXT \xB7 ", j.queue.length), j.queue.map((t, i) => /* @__PURE__ */ import_react7.default.createElement("div", {
      key: `${t.uri}-${i}`,
      className: `jam-q-row${dragIdx === i ? " drag-src" : ""}${dragOverIdx === i && dragIdx !== i ? " drag-over" : ""}`,
      draggable: canEdit,
      onDragStart: () => setDragIdx(i),
      onDragOver: (e) => {
        e.preventDefault();
        setDragOverIdx(i);
      },
      onDrop: () => {
        if (dragIdx !== null && dragIdx !== i)
          j.moveInQueue(dragIdx, i);
        setDragIdx(null);
        setDragOverIdx(null);
      },
      onDragEnd: () => {
        setDragIdx(null);
        setDragOverIdx(null);
      }
    }, canEdit && /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-drag-grip"
    }, I.drag), /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-q-num"
    }, i + 1), /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-q-thumb"
    }, t.artUrl ? /* @__PURE__ */ import_react7.default.createElement("img", {
      src: t.artUrl,
      alt: "",
      onError: (e) => {
        e.target.hidden = true;
      }
    }) : /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-q-thumb-ph"
    })), /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-q-meta"
    }, /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-q-title"
    }, t.title), /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-q-artist"
    }, t.artist)), canEdit && /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-q-btns"
    }, /* @__PURE__ */ import_react7.default.createElement("button", {
      className: "jam-q-btn green",
      title: "Play now",
      onClick: () => j.jumpToTrack(t.uri)
    }, I.playItem), /* @__PURE__ */ import_react7.default.createElement("button", {
      className: "jam-q-btn red",
      title: "Remove",
      onClick: () => j.removeFromQueue(t.uri, t.uid)
    }, I.close))))) : null;
    const renderMembers = () => /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-section-card"
    }, /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-section-title"
    }, I.people, " LISTENERS \xB7 ", j.members.length), j.members.map((m, i) => /* @__PURE__ */ import_react7.default.createElement("div", {
      key: m.id + i,
      className: "jam-member-row"
    }, /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-avatar",
      style: { background: AVATAR_COLORS[i % AVATAR_COLORS.length] }
    }, m.image ? /* @__PURE__ */ import_react7.default.createElement("img", {
      src: m.image,
      alt: "",
      onError: (e) => {
        e.target.hidden = true;
      }
    }) : safeInitial(m.name)), /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-member-info"
    }, /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-member-name"
    }, m.name || "Listener"), /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-member-role"
    }, m.isHost ? "\u25CF Host" : "\u25CB Listener")), j.isHost && !m.isHost && /* @__PURE__ */ import_react7.default.createElement("button", {
      className: "jam-icon-btn small red",
      onClick: () => j.kickMember(m.id)
    }, I.kick, "aria-label=", `Kick ${m.name}`))));
    const renderFooter = () => /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-footer"
    }, !j.isHost && /* @__PURE__ */ import_react7.default.createElement("button", {
      className: "jam-btn outline full",
      onClick: j.requestSync
    }, "Sync to Host"), /* @__PURE__ */ import_react7.default.createElement("button", {
      className: "jam-btn red full",
      onClick: j.leaveJam
    }, I.leave, " ", j.isHost ? "End Jam" : "Leave Jam"));
    if (!j.connected)
      return renderDisconnected();
    return /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-root"
    }, /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-header"
    }, /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-header-left"
    }, /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-logo-icon active"
    }, I.jam), /* @__PURE__ */ import_react7.default.createElement("div", null, /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-title"
    }, "Sync Party"), /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-subtitle"
    }, j.isHost ? "Hosting" : j.hostName ? `With ${j.hostName}` : "Connected"))), /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-header-right"
    }, !j.isHost && /* @__PURE__ */ import_react7.default.createElement("span", {
      className: `jam-ping ${j.ping < 0 ? "measuring" : j.ping > 150 ? "bad" : "good"}`
    }, j.ping < 0 ? "\u2026" : `${j.ping}ms`), /* @__PURE__ */ import_react7.default.createElement("button", {
      className: "jam-icon-btn",
      onClick: onClose
    }, I.close))), /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-body scrollable"
    }, /* @__PURE__ */ import_react7.default.createElement("div", {
      className: "jam-live-badge"
    }, /* @__PURE__ */ import_react7.default.createElement("span", {
      className: "jam-live-dot"
    }), /* @__PURE__ */ import_react7.default.createElement("span", null, "Session Active"), /* @__PURE__ */ import_react7.default.createElement("span", {
      className: "jam-badge"
    }, j.isHost ? "HOST" : "GUEST")), renderNowPlaying(), j.isHost && renderSessionSettings(), j.isHost && renderRoomCode(), renderQueue(), renderMembers()), renderFooter());
  };
  var JamMenu_default = JamMenu;

  // src/app.tsx
  async function main() {
    while (!Spicetify?.showNotification || !Spicetify?.Platform) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    while (!Spicetify?.Playbar && !Spicetify?.Topbar) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    let sidebar = document.getElementById("jam-sidebar");
    if (!sidebar) {
      sidebar = document.createElement("div");
      sidebar.id = "jam-sidebar";
      document.body.appendChild(sidebar);
    }
    let isOpen = false;
    const updateBtn = () => {
      if (playbarBtn) {
        playbarBtn.active = isOpen;
      }
      if (topbarBtn && topbarBtn.element) {
        topbarBtn.element.classList.toggle("jam-topbar-btn-active", isOpen);
      }
    };
    const open = () => {
      isOpen = true;
      sidebar?.classList.add("jam-sidebar-visible");
      updateBtn();
    };
    const close = () => {
      isOpen = false;
      sidebar?.classList.remove("jam-sidebar-visible");
      updateBtn();
    };
    const toggle = () => isOpen ? close() : open();
    const jamSvg = `
<svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
>
    <path d="M2 10v3"/>
    <path d="M6 6v11"/>
    <path d="M10 3v18"/>
    <path d="M14 8v7"/>
    <path d="M18 5v13"/>
    <path d="M22 10v3"/>
</svg>
`;
    let playbarBtn = null;
    let topbarBtn = null;
    if (Spicetify.Playbar) {
      playbarBtn = new Spicetify.Playbar.Button(
        "Sync Party",
        jamSvg,
        toggle
      );
      playbarBtn.register();
    } else if (Spicetify.Topbar) {
      topbarBtn = new Spicetify.Topbar.Button(
        "Sync Party",
        jamSvg,
        toggle
      );
    }
    if (Spicetify.ReactDOM.createRoot) {
      Spicetify.ReactDOM.createRoot(sidebar).render(
        /* @__PURE__ */ import_react8.default.createElement(JamProvider, null, /* @__PURE__ */ import_react8.default.createElement(JamMenu_default, {
          onClose: close
        }))
      );
    } else {
      Spicetify.ReactDOM.render(
        /* @__PURE__ */ import_react8.default.createElement(JamProvider, null, /* @__PURE__ */ import_react8.default.createElement(JamMenu_default, {
          onClose: close
        })),
        sidebar
      );
    }
  }
  var app_default = main;

  // ../../../../tmp/spicetify-creator/index.jsx
  (async () => {
    await app_default();
  })();
})();
/**
 * @license lucide-react v1.18.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
(async () => {
    if (!document.getElementById(`syncparty`)) {
      var el = document.createElement('style');
      el.id = `syncparty`;
      el.textContent = (String.raw`
  /* ../../../../tmp/tmp-35677-RzPi9SHLHKBU/19ec5de41db0/styles.css */
:root {
  --jam-green: #1db954;
  --jam-green-hover: #1ed760;
  --jam-bg: #121212;
  --jam-surface: #181818;
  --jam-surface-hover: rgba(255,255,255,0.04);
  --jam-border: rgba(255,255,255,0.07);
  --jam-text: #ffffff;
  --jam-text-muted: rgba(255,255,255,0.5);
  --jam-text-subtle: rgba(255,255,255,0.3);
  --jam-danger: #e84444;
}
#jam-sidebar {
  position: fixed;
  top: 0;
  right: 0;
  width: 360px;
  height: calc(100vh - 90px);
  z-index: 9998;
  transform: translateX(100%);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
}
#jam-sidebar.jam-sidebar-visible {
  transform: translateX(0);
  pointer-events: all;
}
.jam-topbar-btn {
  background: transparent;
  border: none;
  color: #b3b3b3;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 50%;
  transition: color 0.2s, background 0.2s;
  padding: 0;
}
.jam-topbar-btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}
.jam-topbar-btn-active {
  color: #1db954 !important;
}
@keyframes jamPulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
.jam-root {
  font-family:
    "Inter",
    system-ui,
    -apple-system,
    sans-serif;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #121212;
  color: #fff;
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px 0 0 8px;
  overflow: hidden;
  box-shadow: -8px 0 32px rgba(0, 0, 0, 0.6);
}
.jam-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 16px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  flex-shrink: 0;
  background: var(--jam-surface);
}
.jam-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.jam-header-right {
  display: flex;
  align-items: center;
  gap: 6px;
}
.jam-logo-icon {
  width: 36px;
  height: 36px;
  background: rgba(255, 255, 255, 0.07);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.6);
  flex-shrink: 0;
}
.jam-logo-icon.active {
  background: var(--jam-green);
  color: #fff;
  box-shadow: 0 2px 12px rgba(29, 185, 84, 0.45);
  animation: logo-glow 3s ease-in-out infinite;
}
@keyframes logo-glow {
  0%, 100% {
    box-shadow: 0 2px 12px rgba(29, 185, 84, 0.45);
  }
  50% {
    box-shadow: 0 2px 24px rgba(29, 185, 84, 0.8);
  }
}
.jam-title {
  font-size: 16px;
  font-weight: 800;
  letter-spacing: -0.2px;
}
.jam-subtitle {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 1px;
}
.jam-ping {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.07);
  color: rgba(255, 255, 255, 0.4);
}
.jam-ping.measuring {
  color: rgba(255, 255, 255, 0.2);
}
.jam-ping.good {
  background: rgba(29, 185, 84, 0.15);
  color: var(--jam-green);
}
.jam-ping.bad {
  background: rgba(232, 68, 68, 0.15);
  color: var(--jam-danger);
}
.jam-icon-btn {
  width: 30px;
  height: 30px;
  border: none;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.55);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}
.jam-icon-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}
.jam-icon-btn.red:hover {
  background: rgba(232, 68, 68, 0.15);
  color: var(--jam-danger);
}
.jam-icon-btn.green {
  background: rgba(29, 185, 84, 0.12);
  color: var(--jam-green);
}
.jam-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.jam-body::-webkit-scrollbar {
  width: 5px;
}
.jam-body::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}
.jam-live-badge {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 9px 12px;
  background: rgba(29, 185, 84, 0.07);
  border: 1px solid rgba(29, 185, 84, 0.18);
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}
.jam-live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #1db954;
  flex-shrink: 0;
  animation: live-blink 1.6s ease-in-out infinite;
}
@keyframes live-blink {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}
.jam-badge {
  margin-left: auto;
  background: var(--jam-green);
  color: #000;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0.8px;
  padding: 2px 7px;
  border-radius: 10px;
  text-transform: uppercase;
}
.jam-np-card {
  background: var(--jam-surface);
  border: 1px solid var(--jam-border);
  border-radius: 12px;
  overflow: hidden;
  flex-shrink: 0;
}
.jam-np-art-wrap {
  width: 100%;
  aspect-ratio: 1 / 1;
  overflow: hidden;
  background: #0d0d0d;
}
.jam-np-art {
  width: 100%;
  height: 100%;
  -o-object-fit: cover;
  object-fit: cover;
  display: block;
}
.jam-np-art.placeholder {
  background: linear-gradient(135deg, #1a1a2e, #0d0d0d);
}
.jam-np-meta {
  padding: 14px 14px 6px;
}
.jam-np-label {
  font-size: 9px;
  font-weight: 800;
  color: #1db954;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  margin-bottom: 5px;
}
.jam-np-title {
  font-size: 17px;
  font-weight: 900;
  margin: 0 0 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.jam-np-artist {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.jam-progress-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px 6px;
}
.jam-time {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.35);
  font-weight: 600;
  flex-shrink: 0;
}
.jam-progress-rail {
  flex: 1;
  height: 3px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  position: relative;
  cursor: default;
  transition: height 0.15s;
}
.jam-progress-rail:hover {
  height: 5px;
}
.jam-progress-fill {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: #1db954;
  border-radius: 3px;
  transition: width 0.25s linear;
}
.jam-progress-dot {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
  opacity: 0;
  transition: opacity 0.15s;
  pointer-events: none;
}
.jam-progress-rail:hover .jam-progress-dot {
  opacity: 1;
}
.jam-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 8px 14px 16px;
}
.jam-ctrl-btn {
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.55);
  cursor: pointer;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}
.jam-ctrl-btn:hover {
  color: #fff;
  transform: scale(1.08);
}
.jam-ctrl-btn.main {
  background: #fff;
  color: #000;
  width: 52px;
  height: 52px;
  box-shadow: 0 3px 16px rgba(255, 255, 255, 0.15);
}
.jam-ctrl-btn.main:hover {
  transform: scale(1.04);
  box-shadow: 0 4px 20px rgba(255, 255, 255, 0.25);
}
.jam-section-card {
  background: var(--jam-surface);
  border: 1px solid var(--jam-border);
  border-radius: 12px;
  overflow: hidden;
  flex-shrink: 0;
}
.jam-section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 1.2px;
  color: rgba(255, 255, 255, 0.3);
  padding: 11px 14px 8px;
  text-transform: uppercase;
}
.jam-setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 14px 14px;
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
}
.jam-toggle {
  width: 40px;
  height: 22px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 11px;
  cursor: pointer;
  position: relative;
  transition: background 0.25s;
  flex-shrink: 0;
}
.jam-toggle.on {
  background: #1db954;
}
.jam-toggle-knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.25s;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
}
.jam-toggle.on .jam-toggle-knob {
  transform: translateX(18px);
}
.jam-q-row {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
  transition: background 0.15s;
  cursor: default;
}
.jam-q-row:first-of-type {
  border-top: 0;
}
.jam-q-row:hover {
  background: rgba(255, 255, 255, 0.04);
}
.jam-q-row.drag-over {
  background: rgba(29, 185, 84, 0.08);
}
.jam-q-row.drag-src {
  opacity: 0.3;
}
.jam-drag-grip {
  color: rgba(255, 255, 255, 0.15);
  cursor: grab;
  flex-shrink: 0;
}
.jam-q-num {
  width: 14px;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.2);
  font-weight: 700;
  flex-shrink: 0;
  text-align: right;
}
.jam-q-thumb {
  width: 38px;
  height: 38px;
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
  background: #0d0d0d;
}
.jam-q-thumb img {
  width: 100%;
  height: 100%;
  -o-object-fit: cover;
  object-fit: cover;
  display: block;
}
.jam-q-thumb-ph {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #1a1a2e, #0d0d0d);
}
.jam-q-meta {
  flex: 1;
  min-width: 0;
}
.jam-q-title {
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.jam-q-artist {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
}
.jam-q-btns {
  display: flex;
  gap: 3px;
  opacity: 0;
  transition: opacity 0.15s;
  flex-shrink: 0;
}
.jam-q-row:hover .jam-q-btns {
  opacity: 1;
}
.jam-q-btn {
  width: 26px;
  height: 26px;
  border: none;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 5px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.5);
  transition: all 0.15s;
}
.jam-q-btn.green:hover {
  background: rgba(29, 185, 84, 0.2);
  color: #1db954;
}
.jam-q-btn.red:hover {
  background: rgba(232, 68, 68, 0.2);
  color: #e84444;
}
.jam-member-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}
.jam-member-row:first-of-type {
  border-top: 0;
}
.jam-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 14px;
  color: #000;
  overflow: hidden;
  flex-shrink: 0;
}
.jam-avatar img {
  width: 100%;
  height: 100%;
  -o-object-fit: cover;
  object-fit: cover;
  display: block;
}
.jam-member-info {
  flex: 1;
  min-width: 0;
}
.jam-member-name {
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.jam-member-role {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.35);
  margin-top: 1px;
}
.jam-id-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 14px 12px;
  gap: 8px;
}
.jam-id-code {
  flex: 1;
  text-align: center;
  font-family: "Courier New", monospace;
  font-size: 20px;
  font-weight: 900;
  color: rgba(255, 255, 255, 0.9);
  letter-spacing: 5px;
}
.jam-share-row {
  display: flex;
  gap: 6px;
  padding: 0 14px 14px;
}
.flex-1 {
  flex: 1;
}
.jam-qr-box {
  margin: 0 14px 14px;
  padding: 14px;
  background: #fff;
  border-radius: 10px;
  text-align: center;
}
.jam-qr-box img {
  width: 100%;
  display: block;
  border-radius: 6px;
}
.jam-qr-label {
  font-size: 11px;
  color: #000;
  font-weight: 700;
  margin-top: 8px;
}
.jam-footer {
  padding: 12px 14px 14px;
  border-top: 1px solid var(--jam-border);
  flex-shrink: 0;
  background: var(--jam-surface);
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.jam-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 16px;
  height: 40px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
  white-space: nowrap;
  font-family: inherit;
}
.jam-btn.full {
  width: 100%;
  box-sizing: border-box;
}
.jam-btn.green {
  background: #1db954;
  color: #000;
}
.jam-btn.green:hover {
  background: #1ed760;
}
.jam-btn.outline {
  background: transparent;
  border: 1.5px solid rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.75);
}
.jam-btn.outline:hover {
  border-color: rgba(255, 255, 255, 0.35);
  color: #fff;
  background: rgba(255, 255, 255, 0.04);
}
.jam-btn.red {
  background: rgba(232, 68, 68, 0.12);
  color: #e84444;
  border: 1.5px solid rgba(232, 68, 68, 0.25);
}
.jam-btn.red:hover {
  background: #e84444;
  color: #fff;
}
.jam-input {
  width: 100%;
  padding: 11px 14px;
  box-sizing: border-box;
  background: rgba(255, 255, 255, 0.05);
  border: 1.5px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  color: #fff;
  font-size: 13px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s;
}
.jam-input::-moz-placeholder {
  color: rgba(255, 255, 255, 0.22);
}
.jam-input::placeholder {
  color: rgba(255, 255, 255, 0.22);
}
.jam-input:focus {
  border-color: rgba(29, 185, 84, 0.45);
}
.jam-divider {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.25);
  font-weight: 600;
}
.jam-divider-line {
  flex: 1;
  height: 1px;
  background: rgba(255, 255, 255, 0.07);
}
.jam-hero {
  text-align: center;
  padding: 20px 0 8px;
}
.jam-hero-icon {
  width: 60px;
  height: 60px;
  border-radius: 16px;
  background: linear-gradient(135deg, #1db954, #1ed760);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 14px;
  color: #fff;
  box-shadow: 0 6px 24px rgba(29, 185, 84, 0.35);
}
.jam-hero-title {
  font-size: 20px;
  font-weight: 900;
  margin: 0 0 8px;
}
.jam-hero-desc {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.45);
  line-height: 1.55;
  margin: 0;
}
.jam-error {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 10px 14px;
  background: rgba(232, 68, 68, 0.08);
  border: 1px solid rgba(232, 68, 68, 0.2);
  border-radius: 8px;
  color: #ff8080;
  font-size: 12px;
}
.jam-progress-rail.clickable {
  cursor: pointer;
}
.jam-progress-rail.readonly {
  cursor: default;
}
.jam-divider {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #333;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  margin: 2px 0;
}
.jam-divider-line {
  flex: 1;
  height: 1px;
  background: rgba(255, 255, 255, 0.05);
}
.jam-error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: rgba(228, 68, 68, 0.08);
  border: 1px solid rgba(228, 68, 68, 0.2);
  border-radius: 10px;
  color: #e84444;
  font-size: 12px;
}
.jam-join-btn {
  margin-top: 8px;
}
.jam-icon-btn {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: #555;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  padding: 0;
}
.jam-icon-btn:hover {
  background: rgba(255, 255, 255, 0.07);
  color: #aaa;
}
.jam-icon-btn.green {
  color: #1db954;
}
.jam-icon-btn.small {
  width: 26px;
  height: 26px;
  border-radius: 6px;
}
.jam-icon-btn.red:hover {
  background: rgba(228, 68, 68, 0.15);
  color: #e84444;
}
@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(0.85);
  }
}
.room-code-input {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin: 8px 0;
}
.room-code-cell {
  flex: 1;
  max-width: 48px;
}
.room-code-cell input {
  width: 100%;
  height: 52px;
  border: 1.5px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  text-align: center;
  font-size: 22px;
  font-weight: 800;
  text-transform: uppercase;
  outline: none;
  transition: all 0.15s ease;
  box-sizing: border-box;
}
.room-code-cell input:focus {
  border-color: #1db954;
  box-shadow: 0 0 0 2px rgba(29, 185, 84, 0.2);
  background: rgba(255, 255, 255, 0.08);
}
.room-code-cell input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

      `).trim();
      document.head.appendChild(el);
    }
  })()
      })();