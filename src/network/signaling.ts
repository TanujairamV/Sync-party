const SIGNAL_URL =
    'wss://jam-rtc.tanujairam.workers.dev'

export class SignalingClient {
    private ws: WebSocket | null = null

    public clientId: string | null = null

    private onPeerJoinedCallback:
        ((clientId: string) => void) | null = null

    onPeerJoined(
        callback: (clientId: string) => void
    ) {
        this.onPeerJoinedCallback =
            callback
    }

    async connect(
        roomId: string,
        onMessage: (data: any) => void
    ) {
        return new Promise<void>((resolve, reject) => {
            this.ws = new WebSocket(
                `${SIGNAL_URL}/room/${roomId}`
            )

            this.ws.onopen = () => {
                console.log(
                    '[SIGNAL] Connected',
                    roomId
                )

                resolve()
            }

            this.ws.onmessage = e => {
                try {
                    const msg = JSON.parse(
                        e.data
                    )

                    if (
                        msg.type === 'CONNECTED' &&
                        msg.clientId
                    ) {
                        this.clientId =
                            msg.clientId

                        console.log(
                            '[SIGNAL] Client ID:',
                            this.clientId
                        )

                        return
                    }

                    if (
                        msg.type === 'PEER_JOINED' &&
                        msg.clientId
                    ) {
                        console.log(
                            '[SIGNAL] Peer joined:',
                            msg.clientId
                        )

                        this.onPeerJoinedCallback?.(
                            msg.clientId
                        )

                        return
                    }

                    onMessage(msg)
                } catch (err) {
                    console.error(
                        '[SIGNAL] Parse error',
                        err
                    )
                }
            }

            this.ws.onerror = err => {
                reject(err)
            }
        })
    }

    async waitForClientId(): Promise<string> {
        while (!this.clientId) {
            await new Promise(resolve =>
                setTimeout(resolve, 50)
            )
        }

        return this.clientId
    }

    send(data: any) {
        this.ws?.send(
            JSON.stringify(data)
        )
    }

    close() {
        this.ws?.close()
    }
}