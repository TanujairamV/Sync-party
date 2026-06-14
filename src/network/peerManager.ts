import { createHost, joinHost } from './webrtc'
import { JamConnection } from '../types/types'
import { Member, TrackInfo } from '../types/jam'
import { fetchUserAsync, getTrack } from '../spotify/api'

type Setter<T> = (value: T | ((prev: T) => T)) => void

type Thenable<T> = {
    then(onfulfilled: (value: T) => any): any
}

type UserRef = { current: { name: string; image: string } }
type AsyncRef<T> = {
    current: Thenable<T> | null
}

type AsyncValueRef<T> = AsyncRef<T>

type ReconnectAttemptRef = { current: number }
type ReconnectTimerRef = { current: ReturnType<typeof setTimeout> | null }

export type SetupConnFn = (conn: JamConnection) => void

export const setupConn = (
    conn: JamConnection,
    conns: { current: Map<string, JamConnection> },
    onData: (d: any, conn: JamConnection) => any,
    onClose: (peerId: string) => void
) => {
    conn.onOpen(() => {
        conns.current.set(conn.id, conn)
    })

    conn.onData((d: any) => {
        onData(d, conn)
    })

    conn.onClose(() => {
        console.warn('[JAM] connection closed', conn.id)
        conns.current.delete(conn.id)
        onClose(conn.id)
    })

    conn.onError((e: any) => {
        console.error('[JAM] connection error', conn.id, e)
    })
}

export const startJam = async (params: {
    retries?: number
    userPromise: AsyncValueRef<{ name: string; image: string }>
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
    refreshQueue: () => any
    setupConn: SetupConnFn
}) => {
    const retries = params.retries || 0
    const me = await (params.userPromise.current || fetchUserAsync())
    params.cachedUser.current = me

    const genId = () => Math.random().toString(36).substring(2, 8).toUpperCase()

    console.log('[HOST] Creating room...')

    const jamId = genId()
    const manager = await createHost(jamId, params.setupConn)

    params.setJamId(jamId)
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

    return manager
}

export const joinJam = async (params: {
    id: string
    name?: string
    userPromise: AsyncValueRef<{ name: string; image: string }>
    cachedUser: UserRef
    conns: { current: Map<string, JamConnection> }
    setJamId: Setter<string>
    setIsHost: Setter<boolean>
    setConnected: Setter<boolean>
    setError: Setter<string | null>
    setMembers: Setter<Member[]>
    leaveJam: () => void
    reconnectAttempt: ReconnectAttemptRef
    reconnectTimer: ReconnectTimerRef
    setupConn: SetupConnFn
    onData: (d: any, conn: JamConnection) => any
}) => {
    const me = await (params.userPromise.current || fetchUserAsync())
    params.cachedUser.current = me

    const cleanId = params.id.includes('jam=')
        ? params.id.split('jam=')[1]
        : params.id.trim()

    console.log('[GUEST] Join requested')
    console.log('[GUEST] User:', me.name)
    console.log('[GUEST] Room ID:', cleanId)

    const manager = await joinHost(cleanId, params.setupConn)

    params.setJamId(cleanId)
    params.setIsHost(false)
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

    return manager
}
