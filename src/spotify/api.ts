import { TrackInfo } from '../types/jam'

export const fmtImg = (u?: string): string => {
    if (!u) return ''
    if (u.startsWith('https://')) return u
    if (u.startsWith('spotify:image:')) return `https://i.scdn.co/image/${u.slice(14)}`
    return ''
}

export const fetchUserAsync = async (): Promise<{ name: string; image: string }> => {
    try {
        const user = await (Spicetify as any).Platform?.UserAPI?.getUser()
        if (user?.displayName) {
            return {
                name: user.displayName,
                image: fmtImg(user.images?.[0]?.url || user.images?.[0] || '')
            }
        }
    } catch {}

    try {
        const res = await (Spicetify as any).CosmosAsync.get('sp://identity/v1/profile')
        if (res?.displayName || res?.name) {
            return {
                name: res.displayName || res.name,
                image: fmtImg(res.imageUrl || res.image || '')
            }
        }
    } catch {}

    const name =
        (Spicetify as any).Username ||
        document.querySelector('[data-testid="user-widget-name"]')?.textContent?.trim() ||
        document.querySelector('.main-userWidget-displayName')?.textContent?.trim() ||
        'Listener'

    return { name, image: '' }
}

export const getTrack = (): TrackInfo | null => {
    const t = Spicetify.Player.data?.item
    if (!t) return null
    const meta = t.metadata || {}
    return {
        title: t.name || meta.title || 'Unknown',
        artist: t.artists?.[0]?.name || meta.artist_name || 'Unknown',
        artUrl: fmtImg(meta.image_xlarge_url || meta.image_large_url || meta.image_url || t.images?.[0]?.url),
        uri: t.uri,
        uid: t.uid
    }
}

export const extractTrack = (t: any): TrackInfo => {
    const data = t?.contextTrack || t?.track || t || {}
    const meta = data?.metadata || t?.metadata || {}
    const title = data.name || meta.name || meta.title || t.name || '?'
    const artist = (data.artists?.[0]?.name) || meta.artist_name || meta.album_artist || t.artist_name || '?'
    const artUrl = fmtImg(meta.image_xlarge_url || meta.image_large_url || meta.image_url || data.album?.images?.[0]?.url || t.imageUrl || meta.thumbnail_url)
    const uri = data.uri || t.uri || ''
    const uid = data.uid || t.uid || ''
    return { title, artist, artUrl, uri, uid }
}

export const getQueue = async (): Promise<TrackInfo[]> => {
    try {
        let tracks: any[] = []

        try {
            const res = await (Spicetify as any).Platform?.PlayerAPI?.getQueue()
            if (res) {
                const queued = res.queued || []
                const autoplay = res.autoplay || res.context || res.nextTracks || []
                if (queued.length > 0 || autoplay.length > 0) {
                    tracks = [...queued, ...autoplay]
                }
            }
        } catch {}

        if (!tracks || tracks.length === 0) {
            if (Spicetify.Player?.data?.next_tracks) {
                tracks = Spicetify.Player.data.next_tracks
            }
        }

        if (!tracks || tracks.length === 0) {
            tracks = Spicetify.Queue?.nextTracks || []
        }

        if (!tracks || tracks.length === 0) {
            try {
                const res = await (Spicetify as any).CosmosAsync.get('sp://player/v2/main/queue')
                tracks = res?.next_tracks || res?.tracks || []
            } catch {}
        }

        if (!tracks) return []

        const seen = new Set<string>()
        return tracks.map(extractTrack).filter((t: TrackInfo) => {
            if (!t.uri || seen.has(t.uid || t.uri!)) return false
            if (t.title === '?' && t.artist === '?') return false
            seen.add(t.uid || t.uri!)
            return true
        }).slice(0, 40)
    } catch {
        return []
    }
}
