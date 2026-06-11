import { JamConnection } from './types'
import { WebRTCPeerManager } from './WebRTCPeerManager'
import { SignalingClient } from './signaling'

const ICE_SERVERS = [
    {
        urls: 'stun:stun.l.google.com:19302'
    }
]

const sleep = (ms: number) => ({
    then(resolve: () => void) {
        setTimeout(resolve, ms)
    }
})

class DeferredWebRTCConnection implements JamConnection {
    id: string
    private channel: RTCDataChannel | null = null
    private openListeners: Array<() => void> = []
    private dataListeners: Array<(data: any) => void> = []
    private closeListeners: Array<() => void> = []
    private errorListeners: Array<(e: any) => void> = []
    private queuedMessages: any[] = []
    private closed = false

    constructor(id: string) {
        this.id = id
    }

    attach(channel: RTCDataChannel) {
        if (this.channel || this.closed) return

        this.channel = channel
        this.channel.addEventListener('open', () => {
            this.openListeners.forEach(cb => cb())
        })
        this.channel.addEventListener('message', e => {
            const data = JSON.parse(e.data)
            this.dataListeners.forEach(cb => cb(data))
        })
        this.channel.addEventListener('close', () => {
            this.closeListeners.forEach(cb => cb())
        })
        this.channel.addEventListener('error', e => {
            this.errorListeners.forEach(cb => cb(e))
        })

        if (this.channel.readyState === 'open') {
            setTimeout(() => {
                this.openListeners.forEach(cb => cb())
            }, 0)
        }

        for (const msg of this.queuedMessages) {
            this.channel.send(JSON.stringify(msg))
        }
        this.queuedMessages = []
    }

    get open(): boolean {
        return this.channel ? this.channel.readyState === 'open' : false
    }

    send(data: any): void {
        if (this.channel && this.channel.readyState === 'open') {
            this.channel.send(JSON.stringify(data))
        } else {
            this.queuedMessages.push(data)
        }
    }

    close(): void {
        this.closed = true
        this.channel?.close()
    }

    onOpen(cb: () => void): void {
        if (this.channel) {
            this.channel.addEventListener('open', cb)
        } else {
            this.openListeners.push(cb)
        }
    }

    onData(cb: (data: any) => void): void {
        if (this.channel) {
            this.channel.addEventListener('message', e => cb(JSON.parse(e.data)))
        } else {
            this.dataListeners.push(cb)
        }
    }

    onClose(cb: () => void): void {
        if (this.channel) {
            this.channel.addEventListener('close', cb)
        } else {
            this.closeListeners.push(cb)
        }
    }

    onError(cb: (e: any) => void): void {
        if (this.channel) {
            this.channel.addEventListener('error', cb)
        } else {
            this.errorListeners.push(cb)
        }
    }
}

export class WebRTCConnection implements JamConnection {
    id: string

    constructor(
        id: string,
        private channel: RTCDataChannel
    ) {
        this.id = id
    }

    get open(): boolean {
        return this.channel.readyState === 'open'
    }

    send(data: any): void {
        this.channel.send(JSON.stringify(data))
    }

    close(): void {
        this.channel.close()
    }

    onOpen(cb: () => void): void {
        this.channel.addEventListener('open', cb)
    }

    onData(cb: (data: any) => void): void {
        this.channel.addEventListener('message', e => {
            cb(JSON.parse(e.data))
        })
    }

    onClose(cb: () => void): void {
        this.channel.addEventListener('close', cb)
    }

    onError(cb: (e: any) => void): void {
        this.channel.addEventListener('error', cb)
    }
}

export const createHost = async (
    roomId: string,
    onConnection: (conn: JamConnection) => void
) => {
    const manager = new WebRTCPeerManager(roomId, 'host')

    await manager.signaling.connect(
        roomId,
        async msg => {
            if (msg.sender === manager.signaling.clientId) return

            if (msg.type === 'answer') {
                console.log(
                    '[HOST] Answer received from',
                    msg.sender
                )

                const pc = manager.getPeerConnection(msg.sender)
                if (pc) {
                    await pc.setRemoteDescription(msg.answer)
                }
            }

            if (msg.type === 'candidate') {
                const pc = manager.getPeerConnection(msg.sender)
                if (pc) {
                    await pc.addIceCandidate(msg.candidate)
                }
            }

            if (msg.type === 'offer') {
                let pc = manager.getPeerConnection(msg.sender)

                if (!pc) {
                    pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
                    pc.ondatachannel = e => {
                        const conn = new WebRTCConnection(msg.sender, e.channel)
                        manager.addConnection(msg.sender, conn, pc)
                        onConnection(conn)
                    }
                    pc.onicecandidate = e => {
                        if (!e.candidate) return
                        manager.signaling.send({
                            sender: manager.signaling.clientId,
                            target: msg.sender,
                            type: 'candidate',
                            candidate: e.candidate
                        })
                    }
                }

                await pc.setRemoteDescription(msg.offer)
                const answer = await pc.createAnswer()
                await pc.setLocalDescription(answer)

                manager.signaling.send({
                    sender: manager.signaling.clientId,
                    target: msg.sender,
                    type: 'answer',
                    answer
                })
            }
        }
    )

    await manager.signaling.waitForClientId()

    manager.signaling.onPeerJoined(async peerId => {
            console.log(
                '[HOST] Creating RTC for',
                peerId
            )
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
        const channel = pc.createDataChannel('jam')
        const conn = new WebRTCConnection(peerId, channel)

        manager.addConnection(peerId, conn, pc)
        onConnection(conn)

        pc.onicecandidate = e => {
            console.log(
                '[HOST ICE]',
                e.candidate?.candidate
            )
            if (!e.candidate) return
            manager.signaling.send({
                sender: manager.signaling.clientId,
                target: peerId,
                type: 'candidate',
                candidate: e.candidate
            })
        }

        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
            console.log(
                '[HOST] Sending offer to',
             peerId
         )

        manager.signaling.send({
            sender: manager.signaling.clientId,
            target: peerId,
            type: 'offer',
            offer
        })
    })

    return manager
}

export const joinHost = async (
    roomId: string,
    onConnection: (conn: JamConnection) => void
) => {
    const manager = new WebRTCPeerManager(roomId, 'guest')
    let hostId: string | null = null

    const createGuestConnection = () => {
        const deferred = new DeferredWebRTCConnection(roomId)
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

        manager.addConnection(roomId, deferred, pc)

        pc.onicecandidate = e => {
            if (!e.candidate || !hostId) return
            manager.signaling.send({
                sender: manager.signaling.clientId,
                target: hostId,
                type: 'candidate',
                candidate: e.candidate
            })
        }

        pc.ondatachannel = e => {
            deferred.attach(e.channel)
        }

        deferred.onClose(() => {
            manager.removeConnection(roomId)
        })

        onConnection(deferred)
        return deferred
    }

    manager.setGuestConnectionFactory(createGuestConnection)
    createGuestConnection()

    await manager.signaling.connect(
        roomId,
        async msg => {
            if (manager.signaling.clientId && msg.sender === manager.signaling.clientId) return

            if (msg.type === 'offer') {
                hostId = msg.sender
                const pc = manager.getPeerConnection(roomId)
                if (!pc) return

                await pc.setRemoteDescription(msg.offer)
                const answer = await pc.createAnswer()
                await pc.setLocalDescription(answer)

                manager.signaling.send({
                    sender: manager.signaling.clientId,
                    target: hostId,
                    type: 'answer',
                    answer
                })
            }

            if (msg.type === 'candidate' && msg.sender === hostId) {
                const pc = manager.getPeerConnection(roomId)
                if (!pc) return

                await pc.addIceCandidate(msg.candidate)
            }
        }
    )

    await manager.signaling.waitForClientId()

    return manager
}
