// server.ts
import { Hono } from 'hono'
import { createServer, IncomingMessage } from 'http'
import { WebSocketServer, WebSocket, RawData } from 'ws'
import type { Socket } from 'net'
import type { BoxState, ServerMessage, ClientMessage } from './types'

const PORT = 8080

// --- Hono App (HTTP) ---
const app = new Hono()

app.get('/healthz', (c) => c.text('ok'))

// Node-HTTP-Server aus Hono-App bauen
// @ts-ignore
const server = createServer(app)
server.listen(PORT, () => {
    console.log(`[cakeboxes] http/ws on :${PORT}`)
})

// --- WebSocket-Server (ws) ---
const wss = new WebSocketServer({ noServer: true })

// In-Memory State (ein Pod => MVP). Für Prod: Redis pub/sub.
let boxes: BoxState = [true, true, true, true, true]

function broadcastState() {
    const msg: ServerMessage = { type: 'state', boxes }
    const data = JSON.stringify(msg)
    wss.clients.forEach((c) => {
        if (c.readyState === WebSocket.OPEN) c.send(data)
    })
}

// Upgrade nur für /ws erlauben
server.on('upgrade', (req: IncomingMessage, socket: Socket, head: Buffer) => {
    const url = new URL(req.url ?? '', 'http://localhost')
    if (url.pathname !== '/ws') {
        socket.destroy()
        return
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req)
    })
})

// WS-Handling
wss.on('connection', (ws: WebSocket) => {
    // Beim Connect: aktuellen Zustand schicken
    ws.send(JSON.stringify({ type: 'state', boxes } as ServerMessage))

    ws.on('message', (raw: RawData) => {
        try {
            const msg = JSON.parse(String(raw)) as ClientMessage
            if (msg.type === 'remove') {
                if (msg.index >= 0 && msg.index < boxes.length && boxes[msg.index]) {
                    boxes[msg.index] = false
                    broadcastState()
                }
            } else if (msg.type === 'reset') {
                boxes = [true, true, true, true, true]
                broadcastState()
            }
        } catch {
            // ignore bad input
        }
    })
})
