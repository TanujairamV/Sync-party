export interface SyncState {
    position: number
    timestamp: number
    playing: boolean
}

export function predictPosition(
    position: number,
    timestamp: number,
    playing: boolean
): number {
    if (!playing) {
        return Math.max(0, position)
    }

    return Math.max(
        0,
        position + (Date.now() - timestamp)
    )
}

export function getSyncTarget(
    state: SyncState
): number {
    return predictPosition(
        state.position,
        state.timestamp,
        state.playing
    )
}

export function calculateDrift(
    localPosition: number,
    remotePosition: number
): number {
    return remotePosition - localPosition
}

export function shouldHardSeek(
    drift: number
): boolean {
    return Math.abs(drift) > 500
}

export function shouldIgnore(
    drift: number
): boolean {
    return Math.abs(drift) < 100
}