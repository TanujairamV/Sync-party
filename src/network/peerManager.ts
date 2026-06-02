import { DataConnection, Peer } from 'peerjs'
import { Member, TrackInfo } from '../types/jam'
import { fetchUserAsync, getTrack } from '../spotify/player'
import { PEER_CONFIG } from './peerConfig'

type Setter<T> = (value: T | ((prev: T) => T)) => void

type UserRef = { current: { name: string; image: string } }
type PromiseRef = { current: Promise<{ name: string; image: string }> | null }
type ConnsRef = { current: Map<string, DataConnection> }
type ReconnectAttemptRef = { current: number }
type ReconnectTimerRef = { current: ReturnType<typeof setTimeout> | null }

export type SetupConnFn = (conn: DataConnection) => void

export const setupConn = (
    conn: DataConnection,
    conns: ConnsRef,
    onData: (d: any, conn: DataConnection) => Promise<void>,
    onClose: (peerId: string) => void
) => {
    console.log('[JAM] setupConn', conn.peer)

    conn.on('open', () => {
        console.log('[JAM] connection open', conn.peer)
        conns.current.set(conn.peer, conn)
    })

    conn.on('data', (d: any) => {
        console.log('[JAM] data received', d?.type, 'from', conn.peer)
        onData(d, conn)
    })

    conn.on('close', () => {
        console.warn('[JAM] connection closed', conn.peer)
        conns.current.delete(conn.peer)
        onClose(conn.peer)
    })

    conn.on('error', (e: any) => {
        console.error('[JAM] connection error', conn.peer, e)
    })
}

export const startJam = async (params: {
    retries?: number
    userPromise: PromiseRef
    cachedUser: UserRef
    setJamId: Setter<string>
    setIsHost: Setter<boolean>
    setConnected: Setter<boolean>
    setError: Setter<string | null>
    setHostName: Setter<string>
    setMembers: Setter<Member[]>
    setNowPlaying: Setter<TrackInfo | null>
    setIsPlaying: Setter<boolean>
    setProgress: Setter<number>
    setDuration: Setter<number>
    refreshQueue: () => Promise<void>
    setupConn: SetupConnFn
}): Promise<Peer> => {
    const retries = params.retries || 0
    const me = await (params.userPromise.current || fetchUserAsync())
    params.cachedUser.current = me

    const genId = () => Math.random().toString(36).substring(2, 8).toUpperCase()

    console.log('[HOST] Creating room...')

    const p = new Peer(genId(), PEER_CONFIG)

    return new Promise<Peer>((res, rej) => {
        p.on('open', id => {
            console.log('[HOST] Room created:', id)

            params.setJamId(id)
            params.setIsHost(true)
            params.setConnected(true)
            params.setError(null)
            params.setHostName(me.name)
            params.setMembers([
                {
                    id: 'host',
                    name: me.name,
                    image: me.image,
                    isHost: true
                }
            ])

            const t = getTrack()

            if (t) {
                params.setNowPlaying(t)
            }

            params.setIsPlaying((Spicetify as any).Player.isPlaying())
            params.setProgress((Spicetify as any).Player.getProgress())
            params.setDuration((Spicetify as any).Player.getDuration())

            setTimeout(params.refreshQueue, 500)

            console.log('[HOST] Ready for connections')

            res(p)
        })

        p.on('connection', conn => {
            console.log('[HOST] Incoming connection from:', conn.peer)
            conn.on('open', () => {
                console.log('[HOST] RAW OPEN', conn.peer)
            })

            conn.on('error', e => {
                console.error('[HOST] RAW ERROR', e)
            })

            conn.on('close', () => {
                console.warn('[HOST] RAW CLOSE', conn.peer)
            })
            params.setupConn(conn)
        })

        p.on('disconnected', () => {
            console.warn('[HOST] Peer disconnected from server')
        })

        p.on('close', () => {
            console.warn('[HOST] Peer closed')
        })

        p.on('error', e => {
            console.error('[HOST] Peer error:', e)

            if ((e as any).type === 'id-taken' && retries < 5) {
                console.warn('[HOST] ID already taken, retrying...')
                p.destroy()
                startJam({ ...params, retries: retries + 1 })
                    .then(res)
                    .catch(rej)
            } else {
                params.setError(`Connection error: ${(e as any).type}`)
                rej(e)
            }
        })
    })
}

export const joinJam = async (params: {
    id: string
    name?: string
    userPromise: PromiseRef
    cachedUser: UserRef
    conns: ConnsRef
    setJamId: Setter<string>
    setIsHost: Setter<boolean>
    setConnected: Setter<boolean>
    setError: Setter<string | null>
    setMembers: Setter<Member[]>
    leaveJam: () => void
    reconnectAttempt: ReconnectAttemptRef
    reconnectTimer: ReconnectTimerRef
    setupConn: SetupConnFn
    onData: (d: any, conn: DataConnection) => Promise<void>
}): Promise<Peer> => {
    const me = await (params.userPromise.current || fetchUserAsync())
    params.cachedUser.current = me

    const cleanId = params.id.includes('jam=')
        ? params.id.split('jam=')[1]
        : params.id.trim()

    console.log('[GUEST] Join requested')
    console.log('[GUEST] User:', me.name)
    console.log('[GUEST] Room ID:', cleanId)

    const p = new Peer(undefined, PEER_CONFIG)

    return new Promise<Peer>((res, rej) => {
        let settled = false

        const timeout = setTimeout(() => {
            if (!settled) {
                console.error('[GUEST] CONNECTION TIMEOUT')

                settled = true
                p.destroy()

                const msg =
                    'Connection timed out — check the Jam ID and try again'

                params.setError(msg)
                rej(new Error(msg))
            }
        }, 10000)

        const settle = (fn: () => void) => {
            if (settled) return

            settled = true
            clearTimeout(timeout)

            fn()
        }

        p.on('open', id => {
            console.log('[GUEST] Peer opened')
            console.log('[GUEST] Peer ID:', id)

            const conn = p.connect(cleanId, {
                reliable: true
            })
            const iceLogger = setInterval(() => {
                try {
                    const pc = (conn as any)?._negotiator?._pc

                    if (!pc) {
                        console.log('[GUEST ICE] No RTCPeerConnection yet')
                        return
                    }

                    console.log('[GUEST ICE]', {
                        connectionState: pc.connectionState,
                        iceConnectionState: pc.iceConnectionState,
                        iceGatheringState: pc.iceGatheringState,
                        signalingState: pc.signalingState
                    })
                } catch (e) {
                    console.error('[GUEST ICE] Error', e)
                }
            }, 2000)
            
            console.log('[GUEST] connect() called')
            console.log('[GUEST] Connecting to:', cleanId)
            console.log('[GUEST] Connection object:', conn)
            console.log('[GUEST] conn.open:', conn.open)
            console.log('[GUEST] local peer id:', p.id)

            setTimeout(() => {
                console.log('[GUEST] After 2s conn.open:', conn.open)
                console.log('[GUEST] After 2s peer id:', p.id)
            }, 2000)

            conn.on('open', () => {
                console.log('[GUEST] CONNECTION ESTABLISHED')
                settle(() => {
                    params.conns.current.set(cleanId, conn)

                    params.setJamId(cleanId)
                    params.setIsHost(false)
                    params.setConnected(true)
                    params.setError(null)

                    params.setMembers([
                        {
                            id: cleanId,
                            name: 'Host',
                            isHost: true
                        },
                        {
                            id: 'me',
                            name: me.name,
                            image: me.image
                        }
                    ])

                    console.log('[GUEST] Sending JOIN packet')

                    conn.send({
                        type: 'JOIN',
                        name: me.name,
                        image: me.image
                    })

                    res(p)
                })
            })

            conn.on('data', (d: any) => {
                console.log('[GUEST] DATA RECEIVED:', d?.type)
                params.onData(d, conn)
            })

            conn.on('close', () => {
                console.warn('[GUEST] CONNECTION CLOSED')

                if (params.reconnectAttempt.current >= 3) {
                    console.error('[GUEST] Max reconnect attempts reached')

                    params.leaveJam()
                    params.setError('Host ended the session')
                    return
                }

                params.reconnectAttempt.current++

                console.warn(
                    `[GUEST] Reconnecting (${params.reconnectAttempt.current}/3)`
                )

                params.setError(
                    `Reconnecting (${params.reconnectAttempt.current}/3)...`
                )

                params.reconnectTimer.current = setTimeout(() => {
                    if (!(p as any)) return

                    console.log('[GUEST] Attempting reconnect')

                    const newConn = (p as any).connect(cleanId)

                    newConn.on('open', () => {
                        console.log('[GUEST] RECONNECTED')

                        params.conns.current.clear()
                        params.conns.current.set(cleanId, newConn)

                        params.setConnected(true)
                        params.setError(null)

                        params.reconnectAttempt.current = 0

                        newConn.send({
                            type: 'JOIN',
                            name: me.name,
                            image: me.image
                        })
                    })

                    newConn.on('data', (d: any) => {
                        console.log(
                            '[GUEST] RECONNECT DATA:',
                            d?.type
                        )

                        params.onData(d, newConn)
                    })

                    newConn.on('close', () => {
                        console.warn('[GUEST] RECONNECT CLOSED')

                        if (params.reconnectAttempt.current >= 3) {
                            params.leaveJam()
                            params.setError('Host ended the session')
                        } else {
                            params.reconnectAttempt.current++

                            console.warn(
                                `[GUEST] Retry reconnect (${params.reconnectAttempt.current}/3)`
                            )

                            params.setError(
                                `Reconnecting (${params.reconnectAttempt.current}/3)...`
                            )

                            params.reconnectTimer.current = setTimeout(() => {
                                if (!(p as any)) return

                                console.log(
                                    '[GUEST] Creating retry connection'
                                )

                                const retryConn = (p as any).connect(cleanId)

                                params.setupConn(retryConn)

                                params.conns.current.set(
                                    cleanId,
                                    retryConn
                                )

                                params.setConnected(true)
                                params.setError(null)

                                params.reconnectAttempt.current = 0
                            }, params.reconnectAttempt.current * 2000)
                        }
                    })

                    newConn.on('error', (e: any) => {
                        console.error(
                            '[GUEST] RECONNECT ERROR',
                            e
                        )

                        if (params.reconnectAttempt.current >= 3) {
                            params.leaveJam()

                            params.setError(
                                `Reconnection error: ${
                                    e?.type ||
                                    e?.message ||
                                    'unknown'
                                }`
                            )
                        }
                    })
                }, params.reconnectAttempt.current * 1500)
            })

            conn.on('error', (e: any) => {
                console.error('[GUEST] CONNECTION ERROR', e)

                settle(() => {
                    const msg =
                        `Could not connect to Jam: ${
                            e?.type ||
                            e?.message ||
                            'connection error'
                        }`

                    params.setError(msg)
                    rej(new Error(msg))
                })
            })
        })

        p.on('error', (e: any) => {
            console.error('[GUEST] PEER ERROR', e)

            settle(() => {
                const msg =
                    e?.type === 'peer-unavailable'
                        ? 'Jam not found — check the ID and try again'
                        : `Peer error: ${
                              e?.type ||
                              e?.message ||
                              'unknown'
                          }`

                params.setError(msg)
                rej(new Error(msg))
            })
        })

        p.on('disconnected', () => {
            console.warn('[GUEST] PEER DISCONNECTED')
        })

        p.on('close', () => {
            console.warn('[GUEST] PEER CLOSED')
        })
    })
}