import { JamConnection } from './types'
import { SignalingClient } from './signaling'

type HostCallbacks = {
    onConnection: (
        conn: WebRTCConnection
    ) => void
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
    roomId: string
): Promise<WebRTCConnection> => {
    const signaling = new SignalingClient()

    const pc = new RTCPeerConnection({
        iceServers: [
            {
                urls: 'stun:stun.l.google.com:19302'
            }
        ]
    })

    const channel =
        pc.createDataChannel('jam')

    await signaling.connect(
        roomId,
        async msg => {
            if (msg.sender === signaling.clientId)
                return

            if (msg.type === 'answer') {
                await pc.setRemoteDescription(
                    msg.answer
                )
            }

            
            if (msg.type === 'candidate') {
                await pc.addIceCandidate(
                    msg.candidate
                )
            }
        }
    )

    await signaling.waitForClientId()

    signaling.onPeerJoined(peerId => {
        console.log(
            '[WEBRTC] Guest joined',
            peerId
        )
    })

    pc.onicecandidate = e => {
        if (!e.candidate) return

        signaling.send({
            sender: signaling.clientId,
            type: 'candidate',
            candidate: e.candidate
        })
    }

    const offer =
        await pc.createOffer()

    await pc.setLocalDescription(
        offer
    )

    signaling.send({
        sender: signaling.clientId,
        type: 'offer',
        offer
    })

    return new WebRTCConnection(
        'guest',
        channel
    )
}

export const joinHost = async (
    roomId: string
): Promise<WebRTCConnection> => {
    const signaling = new SignalingClient()

    const pc = new RTCPeerConnection({
        iceServers: [
            {
                urls: 'stun:stun.l.google.com:19302'
            }
        ]
    })

    return new Promise(async resolve => {
        await signaling.connect(
            roomId,
            async msg => {
                if (
                    signaling.clientId &&
                    msg.sender === signaling.clientId
                )
                    return

                if (msg.type === 'offer') {
                    await pc.setRemoteDescription(
                        msg.offer
                    )

                    const answer =
                        await pc.createAnswer()

                    await pc.setLocalDescription(
                        answer
                    )

                    signaling.send({
                        sender: signaling.clientId,
                        type: 'answer',
                        answer
                    })
                }

                if (msg.type === 'candidate') {
                    await pc.addIceCandidate(
                        msg.candidate
                    )
                }
            }
        )

        await signaling.waitForClientId()
        
        pc.onicecandidate = e => {
            if (!e.candidate) return

            signaling.send({
                sender: signaling.clientId,
                type: 'candidate',
                candidate: e.candidate
            })
        }

        pc.ondatachannel = e => {
            const channel = e.channel

            resolve(
                new WebRTCConnection(
                    'host',
                    channel
                )
            )
        }
    })
}