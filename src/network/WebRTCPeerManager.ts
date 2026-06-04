import { JamConnection } from './types'

export class WebRTCPeerManager {
    destroy(): void {
    }

    connect(
        roomId: string
    ): JamConnection {
        throw new Error(
            'Not implemented'
        )
    }
}