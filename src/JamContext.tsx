import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { TrackInfo, Member, JamState } from './types/jam'
import { fetchUserAsync, getTrack, getQueue } from './spotify/player'
import { setupConn as networkSetupConn, startJam as networkStartJam, joinJam as networkJoinJam } from './network/peerManager'
import { WebRTCPeerManager } from './network/WebRTCPeerManager'
import { onData as handlePeerData } from './network/messageHandlers'
import { JamConnection } from './network/types'

const Ctx = createContext<JamState | undefined>(undefined)

export const JamProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isHost, setIsHost] = useState(false)
    const [jamId, setJamId] = useState('')
    const [members, setMembers] = useState<Member[]>([])
    const [connected, setConnected] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [nowPlaying, setNowPlaying] = useState<TrackInfo | null>(null)
    const [hostName, setHostName] = useState('Host')
    const [queue, setQueue] = useState<TrackInfo[]>([])
    const [guestControls, setGuestControls] = useState(false)
    const [isPlaying, setIsPlaying] = useState(false)
    const [progress, setProgress] = useState(0)
    const [duration, setDuration] = useState(0)
    const [ping, setPing] = useState(-1)
    const [updateAvailable, setUpdateAvailable] = useState(false)

    const peerRef = useRef<WebRTCPeerManager | null>(null)

    const conns = useRef<Map<string, JamConnection>>(new Map())
    const memberRegistry = useRef<Map<string, { name: string; image: string }>>(new Map())
    const cachedUser = useRef<{ name: string; image: string }>({ name: 'Listener', image: '' })
    const userPromise = useRef<{ then: (onfulfilled: (value: { name: string; image: string }) => any) => any } | null>(null)
    const refs = useRef({ isHost: false, connected: false, guestControls: false, jamId: '', targetUri: null as string | null, ignoreSync: false, isPlaying: false, forcingPause: false })
    const cmdThrottle = useRef<Map<string, number>>(new Map())
    const lastHostMsg = useRef(0)
    const reconnectAttempt = useRef(0)
    const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const songDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
    const seekTimers = useRef<ReturnType<typeof setTimeout>[]>([])
    const ctxMenuItem = useRef<any>(null)
    const pendingQueueRestore = useRef<TrackInfo[]>([])
    const queueRef = useRef<TrackInfo[]>([])

    useEffect(() => { queueRef.current = queue }, [queue])
    useEffect(() => { refs.current.isHost = isHost }, [isHost])
    useEffect(() => { refs.current.connected = connected }, [connected])
    useEffect(() => { refs.current.guestControls = guestControls }, [guestControls])
    useEffect(() => { refs.current.jamId = jamId }, [jamId])
    useEffect(() => { refs.current.isPlaying = isPlaying }, [isPlaying])

    useEffect(() => {
        userPromise.current = fetchUserAsync()
        userPromise.current.then(u => { cachedUser.current = u })

        const checkUpdate = async () => {
            try {
                const res = await fetch('https://raw.githubusercontent.com/TanujairamV/spicetify-jam/main/manifest.json')
                const data = await res.json()
                if (data.version && data.version !== '1.0.0') {
                    setUpdateAvailable(true)
                    console.log('[Spicetify Jam] Update available:', data.version)
                }
            } catch {}
        }
        checkUpdate()
    }, [])

    const broadcast = useCallback((d: any) => conns.current.forEach(c => c.open && c.send(d)), [])
    const hostConn = useCallback(() => conns.current.get(refs.current.jamId) || Array.from(conns.current.values())[0], [])

    const buildMembers = useCallback((): Member[] => {
        const me = cachedUser.current
        const result: Member[] = []
        if (refs.current.isHost) {
            result.push({ id: 'host', name: me.name, image: me.image, isHost: true })
            conns.current.forEach((_, pid) => {
                const m = memberRegistry.current.get(pid)
                result.push({ id: pid, name: m?.name || 'Listener', image: m?.image || '' })
            })
        }
        return result
    }, [])

    const refreshQueue = useCallback(async () => {
        if (!refs.current.isHost) return
        const q = await getQueue()
        setQueue(q)
        broadcast({ type: 'Q', queue: q })
    }, [broadcast])

    const addToQueue = useCallback(async (uris: string | string[]) => {
        const uriArray = Array.isArray(uris) ? uris : [uris]
        if (refs.current.isHost) {
            try {
                await Spicetify.addToQueue(uriArray.map(uri => ({ uri })))
                Spicetify.showNotification(uriArray.length > 1 ? `Added ${uriArray.length} tracks!` : 'Added!')
                setTimeout(refreshQueue, 1500)
            } catch {
                Spicetify.showNotification('Failed to add to queue', true)
            }
        } else {
            const c = hostConn()
            if (c?.open) {
                uriArray.forEach(uri => c.send({ type: 'ADD_Q', uri }))
                Spicetify.showNotification(uriArray.length > 1 ? `Requested ${uriArray.length} tracks!` : 'Requested!')
            }
        }
    }, [refreshQueue, hostConn])

    const removeFromQueue = useCallback(async (uri: string, uid?: string) => {
        if (refs.current.isHost) {
            try {
                await Spicetify.removeFromQueue([{ uri, uid } as any])
                setTimeout(refreshQueue, 500)
            } catch {
                setTimeout(refreshQueue, 800)
            }
        } else {
            const c = hostConn()
            if (c?.open) c.send({ type: 'RM_Q', uri, uid })
        }
    }, [refreshQueue, hostConn])

    const moveInQueue = useCallback((from: number, to: number) => {
        setQueue(p => {
            const u = [...p]
            const [m] = u.splice(from, 1)
            u.splice(to, 0, m)
            queueRef.current = u
            broadcast({ type: 'Q', queue: u })
            return u
        })
    }, [broadcast])

    const seekTo = useCallback((ms: number) => {
        if (refs.current.isHost) {
            Spicetify.Player.seek(ms)
            broadcast({ type: 'SEEK', pos: ms, ts: Date.now() })
        } else if (refs.current.guestControls) {
            const c = hostConn()
            if (c?.open) c.send({ type: 'CMD', a: 'seek', pos: ms })
        }
    }, [broadcast, hostConn])

    const consumeLocalQueue = useCallback(
        (uri: string) => {
            const idx = queueRef.current.findIndex(t => t.uri === uri)

            if (idx < 0) return
            const q = queueRef.current.slice(idx + 1)
            pendingQueueRestore.current = q
            queueRef.current = q
            setQueue(q)
            broadcast({
                type: "Q",
                queue: q
            })
        },[broadcast]
    )

    const jumpToTrack = useCallback((uri: string) => {
        if (refs.current.isHost) {
            refs.current.targetUri = uri
            consumeLocalQueue(uri)
            Spicetify.Player.playUri(uri)
        } else if (refs.current.guestControls) {
            const c = hostConn()
            if (c?.open) c.send({ type: 'CMD', a: 'playuri', uri })
        }
    }, [hostConn, consumeLocalQueue])

    const toggleGuestControls = () => {
        if (!refs.current.isHost) return
        const v = !guestControls
        setGuestControls(v)
        broadcast({ type: 'GCTRL', on: v })
    }

    const play = () => {
        if (refs.current.isHost) {
            Spicetify.Player.play()
        } else if (refs.current.guestControls) {
            const c = hostConn()
            if (c?.open) c.send({ type: 'CMD', a: 'play' })
        }
    }

    const pause = () => {
        if (refs.current.isHost) {
            Spicetify.Player.pause()
            
        } else if (refs.current.guestControls) {
            const c = hostConn()
            if (c?.open) c.send({ type: 'CMD', a: 'pause' })
        }
    }

    const next = () => {
        if (refs.current.isHost) Spicetify.Player.next()
        else if (refs.current.guestControls) {
            const c = hostConn()
            if (c?.open) c.send({ type: 'CMD', a: 'next' })
        }
    }

    const prev = () => {
        if (refs.current.isHost) Spicetify.Player.back()
        else if (refs.current.guestControls) {
            const c = hostConn()
            if (c?.open) c.send({ type: 'CMD', a: 'back' })
        }
    }

    const requestSync = () => {
        if (!refs.current.isHost) {
            const c = hostConn()
            if (c?.open) c.send({ type: 'SYNC' })
        }
    }

    const leaveJam = useCallback(() => {
        conns.current.forEach(c => c.close())
        conns.current.clear()
        memberRegistry.current.clear()
        peerRef.current?.destroy()
        peerRef.current = null
        setConnected(false)
        setJamId('')
        setIsHost(false)
        refs.current.isHost = false
        refs.current.connected = false
        refs.current.guestControls = false
        refs.current.ignoreSync = false
        refs.current.forcingPause = false
        refs.current.targetUri = null
        setMembers([])
        setQueue([])
        setNowPlaying(null)
        setGuestControls(false)
        setHostName('Host')
        refs.current.targetUri = null
        setPing(-1)
        reconnectAttempt.current = 0
        if (reconnectTimer.current) { clearTimeout(reconnectTimer.current); reconnectTimer.current = null }
        if (songDebounce.current) { clearTimeout(songDebounce.current); songDebounce.current = null }
        seekTimers.current.forEach(clearTimeout)
        seekTimers.current = []
        cmdThrottle.current.clear()
        pendingQueueRestore.current = []
    }, [])

    const kickMember = (id: string) => {
        if (!refs.current.isHost) return
        const c = conns.current.get(id)
        if (c) {
            c.send({ type: 'KICK' })
            setTimeout(() => c.close(), 500)
            conns.current.delete(id)
            memberRegistry.current.delete(id)
            setMembers(buildMembers())
        }
    }

    const onData = useCallback(async (d: any, conn: JamConnection) => {
        await handlePeerData(d, conn, {
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
        })
    }, [buildMembers, addToQueue, removeFromQueue, broadcast, leaveJam])

    const setupConn = useCallback((conn: JamConnection) => {
        networkSetupConn(conn, conns, onData, (peerId: string) => {
            memberRegistry.current.delete(peerId)
            setMembers(buildMembers())
        })

        conn.onOpen(() => {
            if (refs.current.isHost) {
                setMembers(buildMembers())
            } else {
                refs.current.connected = true
                setConnected(true)

                const me = cachedUser.current
                conn.send({
                    type: 'JOIN',
                    name: me.name,
                    image: me.image
                })
            }
        })
    }, [onData, buildMembers])

    const startJam = useCallback(async (retries = 0) => {
        if (refs.current.connected)
            leaveJam()

        refs.current.isHost = true
        refs.current.connected = true

        setIsHost(true)
        setConnected(true) 
        const p = await networkStartJam({
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
            setupConn
        })
        peerRef.current = p

    }, [leaveJam, refreshQueue, setupConn])

    const joinJam = useCallback(async (id: string) => {
        if (refs.current.connected) {
            leaveJam()
        }
        const p = await networkJoinJam({
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
            setupConn,
            onData
        })
        peerRef.current = p
    }, [leaveJam, setupConn, onData])

    useEffect(() => {
        const id = setInterval(() => {
            if (refs.current.isHost) {
                try {
                    setProgress(Spicetify.Player.getProgress())
                    const d = Spicetify.Player.getDuration()
                    if (d !== duration) {
                        setDuration(d)
                    }
                } catch {}
            } else if (refs.current.connected) {
                try {
                    setProgress(Spicetify.Player.getProgress())
                    setDuration(Spicetify.Player.getDuration())
                } catch {}
                const c = hostConn()
                if (c?.open) c.send({ type: 'PING', ts: Date.now() })
                if (lastHostMsg.current > 0 && Date.now() - lastHostMsg.current > 10000) {
                    setError('Connection lost - trying to reconnect...')
                    lastHostMsg.current = 0
                    if (reconnectAttempt.current < 3) {
                        reconnectAttempt.current++
                        reconnectTimer.current = setTimeout(() => {
                            if (!peerRef.current || !refs.current.jamId) return
                            const newConn = peerRef.current.connect(refs.current.jamId)
                            setupConn(newConn)
                            conns.current.set(refs.current.jamId, newConn)
                            refs.current.connected = true
                            setConnected(true)
                            setError(null)
                            reconnectAttempt.current = 0
                            reconnectTimer.current = null
                        }, reconnectAttempt.current * 2000)
                    } else {
                        leaveJam()
                        setError('Lost connection to host')
                    }
                }
                try {
                    const localPlaying = Spicetify.Player.isPlaying()
                    if (localPlaying !== refs.current.isPlaying && !refs.current.isHost) {
                        const c = hostConn()
                        if (c?.open) c.send({ type: 'SYNC' })
                    }
                } catch {}
            }
        }, 1000)
        return () => clearInterval(id)
    }, [hostConn, leaveJam])

    useEffect(() => {
        if (connected) {
            Spicetify.showNotification('✅ Jam Connected')
        }
    }, [connected])

    useEffect(() => {
        if (!connected) return
        const onSong = () => {
            if (songDebounce.current) clearTimeout(songDebounce.current)
            songDebounce.current = setTimeout(() => {
                const uri = Spicetify.Player.data?.item?.uri
                if (refs.current.isHost) {
                    console.log('[HOST] Song change',
                        {
                            uri,
                            playing: Spicetify.Player.isPlaying(),
                            time: Date.now()
                        }
                    )

                    const t = getTrack()
                    if (t) setNowPlaying(t)
                    refs.current.targetUri = uri || null
                    const hostPaused = !Spicetify.Player.isPlaying()
                    broadcast({
                        type: 'PLAY',
                        uri: uri || '',
                        pos: Spicetify.Player.getProgress(),
                        ts: Date.now(),
                        np: t,
                        paused: hostPaused
                    })
                    if (pendingQueueRestore.current.length > 0) {
                        const restore = pendingQueueRestore.current
                        pendingQueueRestore.current = [];
                        (async () => {
                            for (const tr of restore) {
                                if (tr.uri) {
                                    try { await Spicetify.addToQueue([{ uri: tr.uri }]) } catch {}
                                }
                            }
                            setTimeout(refreshQueue, 1000)
                        })()
                    } else {
                        setTimeout(refreshQueue, 600)
                    }
                } else {
                    if (refs.current.ignoreSync) {
                        refs.current.ignoreSync = false
                        return
                    }

                    if (uri && uri !== refs.current.targetUri && refs.current.targetUri) {
                        if (refs.current.guestControls) {
                            const c = hostConn()
                            if (c?.open) c.send({ type: 'CMD', a: 'playuri', uri })
                        } else {
                            console.log('[GUEST] Song change',
                                {
                                    uri,
                                    playing: Spicetify.Player.isPlaying(),
                                    time: Date.now()
                                }
                            )
                            refs.current.ignoreSync = true
                            Spicetify.Player.playUri(refs.current.targetUri).catch(() => {
                                refs.current.ignoreSync = false
                            })
                            Spicetify.showNotification('🔒 Locked to Jam')
                        }
                    }
                }
            }, 300)
        }

        const onPP = () => {
            if (refs.current.ignoreSync) {
                refs.current.ignoreSync = false
                return
            }

            const playing = Spicetify.Player.isPlaying()
            setIsPlaying(playing)
            if (refs.current.isHost) {
                const pos = Spicetify.Player.getProgress()
                const dur = Spicetify.Player.getDuration()

                broadcast({
                    type: 'PS',
                    p: playing,
                    pos,
                    dur 
                })

                if (!playing) {
                    const currentUri = Spicetify.Player.data?.item?.uri
                    if (
                        currentUri &&
                        currentUri === refs.current.targerUri
                    ) {
                        broadcast({
                            type: 'PAUSE',
                            pos,
                            ts: Date.now()
                        })
                    }
                }

            } else {
                if (playing) {
                    if (!refs.current.guestControls) {
                        if (refs.current.forcingPause) return

                        refs.current.forcingPause = true
                        Spicetify.Player.pause()
                        Spicetify.showNotification('🔒 Only the host can resume playback')
                        
                        setTimeout(() => { refs.current.forcingPause = false }, 500)

                        const c = hostConn()
                        if (c?.open) {
                            c.send({ type: 'SYNC' })
                        }
                    } else {
                        const c = hostConn()

                        if (c?.open) {
                            c.send({
                                type: 'CMD',
                                a: 'play'
                            })
                        }

                        const curUri = Spicetify.Player.data?.item?.uri

                        if (
                            refs.current.targetUri &&
                            curUri &&
                            curUri !== refs.current.targetUri
                        ) {
                            refs.current.ignoreSync = true

                            Spicetify.Player.playUri(
                                refs.current.targetUri).catch(() => {
                                refs.current.ignoreSync = false
                            })
                            Spicetify.showNotification('🔒 Locked to Jam')
                        }
                    }
                } else if (refs.current.guestControls) {
                    const c = hostConn()
                    if (c?.open) {
                        c.send({
                            type: 'CMD',
                            a: 'pause'
                        })
                    }
                }
            }
        }

        Spicetify.Player.addEventListener('songchange', onSong)
        Spicetify.Player.addEventListener('onplaypause', onPP)
        let qi: ReturnType<typeof setInterval> | null = refs.current.isHost ? setInterval(refreshQueue, 5000) : null
        let driftI: ReturnType<typeof setInterval> | null = !refs.current.isHost ? setInterval(() => {
            const c = hostConn()
            if (c?.open) c.send({ type: 'SYNC' })
        }, 15000) : null
        try {
            if (ctxMenuItem.current) { try { ctxMenuItem.current.deregister() } catch {} }
            ctxMenuItem.current = new (Spicetify as any).ContextMenu.Item(
                'Add to Jam',
                (uris: string[]) => addToQueue(uris),
                () => refs.current.connected,
                'plus2px'
            )
            ctxMenuItem.current.register()
        } catch {}
        return () => {
            Spicetify.Player.removeEventListener('songchange', onSong)
            Spicetify.Player.removeEventListener('onplaypause', onPP)
            if (qi) clearInterval(qi)
            if (driftI) clearInterval(driftI)
            try { ctxMenuItem.current?.deregister() } catch {}
        }
    }, [connected, isHost, broadcast, refreshQueue, addToQueue, hostConn])

    useEffect(() => {
        const hash = window.location.hash.slice(1)
        if (hash.startsWith('jam=')) {
            const id = hash.split('=')[1]
            if (id && !refs.current.connected) joinJam(id)
        }
    }, [joinJam])

    return (
        <Ctx.Provider value={{
            isHost, jamId, members, connected, error, nowPlaying, hostName, queue,
            guestControls, isPlaying, progress, duration, ping, updateAvailable,
            startJam, joinJam, leaveJam, addToQueue, removeFromQueue,
            moveInQueue, requestSync, jumpToTrack, seekTo, kickMember,
            toggleGuestControls, play, pause, next, prev
        } as any}>
            {children}
        </Ctx.Provider>
    )
}

export const useJam = () => {
    const c = useContext(Ctx);
    if (!c) throw new Error('useJam must be inside JamProvider');
    return c }