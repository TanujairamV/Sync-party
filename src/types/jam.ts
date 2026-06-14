export interface TrackInfo {
    title: string
    artist: string
    artUrl: string
    uri?: string
    uid?: string
}

export interface Member {
    id: string
    name: string
    isHost?: boolean
    image?: string
}

export interface JamState {
    isHost: boolean
    jamId: string
    members: Member[]
    connected: boolean
    error: string | null
    nowPlaying: TrackInfo | null
    hostName: string
    queue: TrackInfo[]
    guestControls: boolean
    isPlaying: boolean
    progress: number
    duration: number
    ping: number
    startJam: () => any
    joinJam: (id: string) => any
    leaveJam: () => void
    addToQueue: (uri: string) => void
    removeFromQueue: (uri: string, uid?: string) => void
    moveInQueue: (from: number, to: number) => void
    requestSync: () => void
    jumpToTrack: (uri: string) => void
    seekTo: (ms: number) => void
    kickMember: (id: string) => void
    toggleGuestControls: () => void
    play: () => void
    pause: () => void
    next: () => void
    prev: () => void
}
