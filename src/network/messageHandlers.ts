import { JamConnection } from '../types/types'
import { TrackInfo, Member } from '../types/jam'
import { getTrack, getQueue } from '../spotify/api'
import { calculateDrift, predictPosition, shouldHardSeek } from "../utils/sync"

type RefCurrent<T> = { current: T }

type MessageHandlerRefs = {
    isHost: boolean
    connected: boolean
    guestControls: boolean
    jamId: string
    targetUri: string | null
    ignoreSync: boolean
    isPlaying: boolean
}

type MessageHandlerDeps = {
    refs: RefCurrent<MessageHandlerRefs>
    lastHostMsg: RefCurrent<number>
    memberRegistry: RefCurrent<Map<string, { name: string; image: string }>>
    cachedUser: RefCurrent<{ name: string; image: string }>
    seekTimers: RefCurrent<ReturnType<typeof setTimeout>[]>
    buildMembers: () => Member[]
    addToQueue: (uri: string) => any
    removeFromQueue: (uri: string, uid?: string) => any
    broadcast: (d: any) => void
    setMembers: (value: Member[] | ((prev: Member[]) => Member[])) => void
    setQueue: (value: TrackInfo[] | ((prev: TrackInfo[]) => TrackInfo[])) => void
    setNowPlaying: (value: TrackInfo | null | ((prev: TrackInfo | null) => TrackInfo | null)) => void
    setHostName: (value: string | ((prev: string) => string)) => void
    setGuestControls: (value: boolean | ((prev: boolean) => boolean)) => void
    setIsPlaying: (value: boolean | ((prev: boolean) => boolean)) => void
    setProgress: (value: number | ((prev: number) => number)) => void
    setDuration: (value: number | ((prev: number) => number)) => void
    setPing: (value: number | ((prev: number) => number)) => void
    setError: (value: string | null | ((prev: string | null) => string | null)) => void
    leaveJam: () => void
    cmdThrottle: RefCurrent<Map<string, number>>
    queueRef: RefCurrent<TrackInfo[]>
    pendingQueueRestore: RefCurrent<TrackInfo[]>
}

const consumeQueue = (
    uri: string,
    deps: MessageHandlerDeps
) => {
    const idx = deps.queueRef.current.findIndex(
        (t: any) => t.uri === uri
    )

    if (idx < 0) return

    const q = deps.queueRef.current.slice(idx + 1)

    deps.queueRef.current = q
    deps.setQueue(q)
}

export const handleJoin = async (d: any, conn: JamConnection, deps: MessageHandlerDeps) => {
    const r = deps.refs.current
    if (!r.isHost) return
    deps.memberRegistry.current.set(conn.id, { name: d.name || 'Listener', image: d.image || '' })
    const all = deps.buildMembers()
    deps.setMembers(all)
    conn.send({
        type: 'INIT',
        np: getTrack(),
        queue: await getQueue(),
        host: deps.cachedUser.current.name,
        gc: r.guestControls,
        playing: (Spicetify as any).Player.isPlaying(),
        members: all,
        progress: (Spicetify as any).Player.getProgress(),
        duration: (Spicetify as any).Player.getDuration()
    })
    if ((Spicetify as any).Player.data?.item) {
        conn.send({
            type: 'PLAY',
            uri: (Spicetify as any).Player.data.item.uri,
            pos: (Spicetify as any).Player.getProgress(),
            ts: Date.now(),
            paused: !(Spicetify as any).Player.isPlaying()
        })
    }
    deps.broadcast({ type: 'MEMBERS', members: all })
}

export const handleInit = (d: any, deps: MessageHandlerDeps) => {
    if (d.np) {
        deps.setNowPlaying(d.np)
        deps.refs.current.targetUri = d.np.uri
    }

    if (d.queue) {
        let q = d.queue

        if (d.np?.uri) {
            const idx = q.findIndex(
                (t: any) => t.uri === d.np.uri
            )
            if (idx >= 0) {
                q = q.slice(idx + 1)
            }
        }
        deps.queueRef.current = q
        deps.setQueue(q)
    }

    if (d.host) deps.setHostName(d.host)
    if (d.members) deps.setMembers(d.members)
    if (d.gc !== undefined) deps.setGuestControls(d.gc)
    if (d.playing !== undefined) deps.setIsPlaying(d.playing)
    if (d.progress !== undefined) deps.setProgress(d.progress)
    if (d.duration !== undefined) deps.setDuration(d.duration)
}

export const handleMembers = (d: any, deps: MessageHandlerDeps) => {
    deps.setMembers(d.members)
}

export const handleGCtrl = (d: any, deps: MessageHandlerDeps) => {
    deps.setGuestControls(d.on)
}

export const handleCmd = (d: any, conn: JamConnection, deps: MessageHandlerDeps) => {
    const r = deps.refs.current
    if (!r.isHost || !r.guestControls) return
    if (Date.now() - (deps.cmdThrottle.current.get(conn.id) || 0) < 500) return
    deps.cmdThrottle.current.set(conn.id, Date.now())
    if (d.a === 'play') (Spicetify as any).Player.play()
    else if (d.a === 'pause') (Spicetify as any).Player.pause()
    else if (d.a === 'next') (Spicetify as any).Player.next()
    else if (d.a === 'back') (Spicetify as any).Player.back()
    else if (d.a === 'seek') (Spicetify as any).Player.seek(d.pos)
    else if (d.a === 'playuri') {
        consumeQueue(d.uri, deps)
        deps.pendingQueueRestore.current = deps.queueRef.current
        deps.broadcast({ type: 'Q', queue: deps.queueRef.current })
        deps.refs.current.targetUri = d.uri
            ; (Spicetify as any).Player.playUri(d.uri)
    }
}

export const handleKick = (d: any, deps: MessageHandlerDeps) => {
    deps.leaveJam()
    deps.setError('Removed from Jam');
    (Spicetify as any).showNotification('Kicked from Jam')
}

export const handlePlay = async (d: any, deps: MessageHandlerDeps) => {
    console.log(
        "[GUEST] PLAY",
        d.uri,
        d.pos,
        d.paused,
        Date.now()
    )
    const r = deps.refs.current
    if (!r.isHost) {
        const curUri = (Spicetify as any).Player.data?.item?.uri
        const trackChanged = curUri !== d.uri

        r.targetUri = d.uri

        if (trackChanged) {
            deps.setProgress(0)
            consumeQueue(d.uri, deps)
        }

        if (d.paused) {
            if (trackChanged) {
                r.ignoreSync = true
                deps.setIsPlaying(false)
                    ; (Spicetify as any).Player.playUri(d.uri).then(() => {
                        setTimeout(() => { (Spicetify as any).Player.pause(); r.ignoreSync = false }, 150)
                    }).catch(() => { r.ignoreSync = false })
            } else {
                (Spicetify as any).Player.pause()
                deps.setIsPlaying(false)
            }
        } else if (!trackChanged) {
            const predicted = predictPosition(d.pos, d.ts, !d.paused)
            const localProgress = (Spicetify as any).Player.getProgress()
            const drift = calculateDrift(localProgress, predicted)

            if (shouldHardSeek(drift)) {
                ; (Spicetify as any).Player.seek(predicted)
            }

            deps.setIsPlaying(!d.paused)

            if (d.paused) {
                if ((Spicetify as any).Player.isPlaying()) {
                    (Spicetify as any).Player.pause()
                }

            } else {
                if (!(Spicetify as any).Player.isPlaying()) {
                    (Spicetify as any).Player.play()
                }
            }

        } else {
            r.ignoreSync = true
            deps.setIsPlaying(true)
                ; (Spicetify as any).Player.playUri(d.uri)
                    .then(() => {
                        const seekMs = predictPosition(d.pos, d.ts, !d.paused)
                        const sid = setTimeout(() => {
                            try {
                                const current = (Spicetify as any).Player.getProgress()
                                const drift = calculateDrift(current, seekMs)
                                if (shouldHardSeek(drift)) {
                                    ; (Spicetify as any).Player.seek(seekMs)
                                }
                            } finally {
                                r.ignoreSync = false
                            }
                        }, Math.max(300, Date.now() - d.ts))
                        deps.seekTimers.current.push(sid)
                    })
                    .catch(() => {
                        r.ignoreSync = false
                    })
        }
    }
    if (d.np) deps.setNowPlaying(d.np)
}

export const handlePause = (d: any, deps: MessageHandlerDeps) => {
    if (!deps.refs.current.isHost) {
        ; (Spicetify as any).Player.pause()
        deps.setIsPlaying(false)
    }
}

export const handleSeek = (d: any, deps: MessageHandlerDeps) => {
    if (!deps.refs.current.isHost) {
        const predicted = predictPosition(d.pos, d.ts, !d.paused)
        const localProgress = (Spicetify as any).Player.getProgress()
        const drift = calculateDrift(localProgress, predicted)

        if (shouldHardSeek(drift)) {
            ; (Spicetify as any).Player.seek(predicted)
        }
    }
}

export const handlePs = (d: any, deps: MessageHandlerDeps) => {
    if (!deps.refs.current.isHost) {
        deps.setIsPlaying(d.p)
        if (d.pos !== undefined) deps.setProgress(d.pos)
        if (d.dur !== undefined) deps.setDuration(d.dur)
    }
}

export const handleAddQ = (d: any, deps: MessageHandlerDeps) => {
    if (deps.refs.current.isHost) deps.addToQueue(d.uri)
}

export const handleRmQ = (d: any, deps: MessageHandlerDeps) => {
    if (deps.refs.current.isHost) deps.removeFromQueue(d.uri, d.uid)
}

export const handleQ = (
    d: any,
    deps: MessageHandlerDeps
) => {
    deps.queueRef.current = d.queue
    deps.setQueue(d.queue)
}

export const handlePing = (d: any, conn: JamConnection, deps: MessageHandlerDeps) => {
    conn.send({ type: 'PONG', ts: d.ts })
}

export const handlePong = (d: any, deps: MessageHandlerDeps) => {
    deps.setPing(Date.now() - d.ts)
}

export const handleSync = async (
    d: any,
    conn: JamConnection,
    deps: MessageHandlerDeps
) => {
    if (
        deps.refs.current.isHost &&
        (Spicetify as any).Player.data?.item
    ) {

        /*
                conn.send({
                    type: 'PLAY',
                    uri: (Spicetify as any).Player.data.item.uri,
                    pos: (Spicetify as any).Player.getProgress(),
                    ts: Date.now(),
                    np: getTrack(),
                    paused: !(Spicetify as any).Player.isPlaying()
                })
        */

        conn.send({
            type: 'Q',
            queue: await getQueue()
        })
    }
}

export const onData = async (d: any, conn: JamConnection, deps: MessageHandlerDeps) => {
    const r = deps.refs.current
    if (!r.isHost) deps.lastHostMsg.current = Date.now()
    switch (d.type) {
        case 'JOIN': return handleJoin(d, conn, deps)
        case 'INIT': return handleInit(d, deps)
        case 'MEMBERS': return handleMembers(d, deps)
        case 'GCTRL': return handleGCtrl(d, deps)
        case 'CMD': return handleCmd(d, conn, deps)
        case 'KICK': return handleKick(d, deps)
        case 'PLAY': return handlePlay(d, deps)
        case 'PAUSE': return handlePause(d, deps)
        case 'SEEK': return handleSeek(d, deps)
        case 'PS': return handlePs(d, deps)
        case 'ADD_Q': return handleAddQ(d, deps)
        case 'RM_Q': return handleRmQ(d, deps)
        case 'Q': return handleQ(d, deps)
        case 'PING': return handlePing(d, conn, deps)
        case 'PONG': return handlePong(d, deps)
        case 'SYNC': return await handleSync(d, conn, deps)
    }
}