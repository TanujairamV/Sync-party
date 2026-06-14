export interface JamConnection {
    id: string
    open: boolean

    send(data: any): void
    close(): void

    onOpen(cb: () => void): void
    onData(cb: (data: any) => void): void
    onClose(cb: () => void): void
    onError(cb: (e: any) => void): void
}