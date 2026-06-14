import { JamConnection } from '../types/types'
import { WebRTCPeerManager } from './WebRTCPeerManager'

export const ICE_SERVERS: RTCIceServer[] = [
    {
        urls: [
            "stun:stun.l.google.com:19302",
            "stun:stun.relay.metered.ca:80"
        ]
    },
    {
        urls: "turn:global.relay.metered.ca:80",
        username: "855afddb586aeb45ff1d8548",
        credential: "FPSBc6fiSuioTE5V"
    },
    {
        urls: "turn:global.relay.metered.ca:80?transport=tcp",
        username: "855afddb586aeb45ff1d8548",
        credential: "FPSBc6fiSuioTE5V"
    },
    {
        urls: "turn:global.relay.metered.ca:443",
        username: "855afddb586aeb45ff1d8548",
        credential: "FPSBc6fiSuioTE5V"
    },
    {
        urls: "turns:global.relay.metered.ca:443?transport=tcp",
        username: "855afddb586aeb45ff1d8548",
        credential: "FPSBc6fiSuioTE5V"
    }
]


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
    const pendingIceCandidates = new Map<string, RTCIceCandidateInit[]>()

    const queueIceCandidate = (
        peerId: string,
        candidate: RTCIceCandidateInit
    ) => {
        const queue = pendingIceCandidates.get(peerId) ?? []
        queue.push(candidate)
        pendingIceCandidates.set(peerId, queue)
    }

    const flushIceCandidates = async (
        peerId: string,
        pc: RTCPeerConnection
    ) => {
        const queued = pendingIceCandidates.get(peerId)
        if (!queued?.length) return

        for (const candidate of queued) {
            await pc.addIceCandidate(candidate)
        }

        pendingIceCandidates.delete(peerId)
    }

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
                    console.log('[HOST] Remote description set')
                    await flushIceCandidates(msg.sender, pc)
                }
            }

            if (msg.type === 'candidate') {
                const pc = manager.getPeerConnection(msg.sender)
                if (!pc || !pc.remoteDescription) {
                    queueIceCandidate(msg.sender, msg.candidate)
                    return
                }

                await pc.addIceCandidate(
                    msg.candidate
                )
            }

            if (msg.type === 'offer') {
                let pc = manager.getPeerConnection(msg.sender)

                if (!pc) {
                    pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
                    const pcRef = pc

                    pcRef.onconnectionstatechange = () => {
                        console.log(
                            '[HOST PC]',
                            pcRef.connectionState
                        )
                    }

                    pcRef.onicegatheringstatechange = () => {
                        console.log(
                            "[HOST GATHER]",
                            pcRef.iceGatheringState
                        )
                    }

                    pcRef.onicecandidateerror = e => {
                        console.log(
                            "[HOST ICE ERROR]",
                            e
                        )
                    }

                    pcRef.oniceconnectionstatechange = () => {
                        console.log(
                            '[HOST ICE STATE]',
                            pcRef.iceConnectionState
                        )
                    }

                    pcRef.ondatachannel = e => {
                        e.channel.onopen = () => {
                            console.log(
                                '[HOST] DataChannel OPEN',
                                msg.sender
                            )
                        }
                        e.channel.onclose = () => {
                            console.log(
                                '[HOST] DataChannel CLOSE',
                                msg.sender
                            )
                        }
                        const conn = new WebRTCConnection(msg.sender, e.channel)
                        manager.addConnection(msg.sender, conn, pcRef)
                        onConnection(conn)
                    }

                    pcRef.onicecandidate = e => {
                        if (!e.candidate) {
                            console.log(
                                "[HOST ICE] COMPLETE"
                            )
                            return
                        }
                        manager.signaling.send({
                            sender: manager.signaling.clientId,
                            target: msg.sender,
                            type: 'candidate',
                            candidate: e.candidate
                        })
                    }
                }

                await pc.setRemoteDescription(msg.offer)
                await flushIceCandidates(msg.sender, pc)
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
        pc.onconnectionstatechange = () => {
            console.log(
                '[HOST PC]',
                pc.connectionState
            )
        }

        pc.onicegatheringstatechange = () => {
            console.log(
                "[HOST GATHER]",
                pc.iceGatheringState
            )
        }

        pc.onicecandidateerror = e => {
            console.log(
                "[HOST ICE ERROR]",
                e
            )
        }

        pc.oniceconnectionstatechange = () => {
            console.log(
                '[HOST ICE STATE]',
                pc.iceConnectionState
            )
        }
        const channel = pc.createDataChannel('jam')

        channel.onopen = () => {
            console.log(
                '[HOST] DataChannel OPEN',
                peerId
            )
        }

        channel.onclose = () => {
            console.log(
                '[HOST] DataChannel CLOSE',
                peerId
            )
        }

        const conn = new WebRTCConnection(peerId, channel)
        manager.addConnection(peerId, conn, pc)
        onConnection(conn)

        pc.onicecandidate = e => {
            if (!e.candidate) {
                console.log(
                    "[HOST ICE] COMPLETE"
                )
                return
            }

            console.log(
                '[HOST ICE]',
                e.candidate.candidate
            )

            manager.signaling.send({
                sender: manager.signaling.clientId,
                target: peerId,
                type: 'candidate',
                candidate: e.candidate
            })
        }

        console.log(
            '[HOST] Creating offer for',
            peerId
        )

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
    const pendingIceCandidates = new Map<string, RTCIceCandidateInit[]>()
    let hostId: string | null = null

    const queueIceCandidate = (
        peerId: string,
        candidate: RTCIceCandidateInit
    ) => {
        const queue = pendingIceCandidates.get(peerId) ?? []
        queue.push(candidate)
        pendingIceCandidates.set(peerId, queue)
    }

    const flushIceCandidates = async (
        peerId: string,
        pc: RTCPeerConnection
    ) => {
        const queued = pendingIceCandidates.get(peerId)
        if (!queued?.length) return

        for (const candidate of queued) {
            await pc.addIceCandidate(candidate)
        }

        pendingIceCandidates.delete(peerId)
    }

    const createGuestConnection = (
        id: string
    ) => {
        const deferred = new DeferredWebRTCConnection(id)
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
        pc.onconnectionstatechange = () => {
            console.log(
                '[GUEST PC]',
                pc.connectionState
            )
        }

        pc.onicegatheringstatechange = () => {
            console.log(
                "[GUEST GATHER]",
                pc.iceGatheringState
            )
        }

        pc.onicecandidateerror = e => {
            console.log(
                "[GUEST ICE ERROR]",
                e
            )
        }

        pc.oniceconnectionstatechange = () => {
            console.log(
                '[GUEST ICE STATE]',
                pc.iceConnectionState
            )
        }
        manager.addConnection(id, deferred, pc)

        pc.onicecandidate = e => {
            if (!e.candidate) {
                console.log(
                    "[GUEST ICE] COMPLETE"
                )
                return
            }

            console.log(
                '[GUEST ICE]',
                e.candidate.candidate
            )

            manager.signaling.send({
                sender: manager.signaling.clientId,
                target: id,
                type: 'candidate',
                candidate: e.candidate
            })
        }

        pc.ondatachannel = e => {
            console.log(
                '[GUEST] DataChannel received'
            )

            e.channel.onopen = () => {
                console.log(
                    '[GUEST] DataChannel OPEN'
                )
            }

            e.channel.onclose = () => {
                console.log(
                    '[GUEST] DataChannel CLOSE'
                )
            }
            deferred.attach(e.channel)
        }

        deferred.onClose(() => {
            manager.removeConnection(id)
        })

        onConnection(deferred)
        return deferred
    }

    await manager.signaling.connect(
        roomId,
        async msg => {
            if (manager.signaling.clientId && msg.sender === manager.signaling.clientId) return

            if (msg.type === 'offer') {
                hostId = msg.sender
                const peerId = msg.sender
                if (!manager.getPeerConnection(peerId)) {
                    createGuestConnection(peerId)
                }

                const pc = manager.getPeerConnection(peerId)
                if (!pc) return
                console.log(
                    '[GUEST] Offer from',
                    peerId
                )
                await pc.setRemoteDescription(msg.offer)
                console.log('[GUEST] Remote description set')
                await flushIceCandidates(peerId, pc)
                const answer = await pc.createAnswer()
                await pc.setLocalDescription(answer)
                console.log(
                    '[GUEST] Sending answer'
                )
                manager.signaling.send({
                    sender: manager.signaling.clientId,
                    target: peerId,
                    type: 'answer',
                    answer
                })
            }

            if (msg.type === 'candidate') {
                const peerId = msg.sender
                if (!hostId) {
                    hostId = peerId
                }

                if (peerId !== hostId) return

                const pc = manager.getPeerConnection(peerId)
                if (!pc || !pc.remoteDescription) {
                    queueIceCandidate(peerId, msg.candidate)
                    return
                }

                await pc.addIceCandidate(
                    msg.candidate
                )
            }
        }
    )

    await manager.signaling.waitForClientId()

    return manager
}
