import { JamConnection } from '../types/types'
import { SignalingClient } from './signaling'

export class WebRTCPeerManager {
    private connections = new Map<string, JamConnection>()
    private peerConnections = new Map<string, RTCPeerConnection>()
    public signaling = new SignalingClient()
    public roomId: string
    public role: 'host' | 'guest'

    constructor(roomId: string, role: 'host' | 'guest') {
        this.roomId = roomId
        this.role = role
    }

    addConnection(
        id: string,
        conn: JamConnection,
        pc?: RTCPeerConnection
    ): void {
        this.connections.set(id, conn)
        if (pc) {
            this.peerConnections.set(id, pc)
        }
    }

    getConnection(id: string): JamConnection | undefined {
        return this.connections.get(id)
    }

    getPeerConnection(id: string): RTCPeerConnection | undefined {
        return this.peerConnections.get(id)
    }

    removeConnection(id: string): void {
        const conn = this.connections.get(id)
        if (conn) {
            conn.close()
            this.connections.delete(id)
        }

        const pc = this.peerConnections.get(id)
        if (pc) {
            pc.close()
            this.peerConnections.delete(id)
        }
    }

    connect(id: string): JamConnection {
        const existing = this.connections.get(id)
        if (existing) {
            return existing
        }

        throw new Error(`Connection not found: ${id}`)
    }

    destroy(): void {
        for (const conn of this.connections.values()) {
            conn.close()
        }

        for (const pc of this.peerConnections.values()) {
            pc.close()
        }

        this.connections.clear()
        this.peerConnections.clear()
        this.signaling.close()
    }
}
