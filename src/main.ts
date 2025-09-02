// server.ts
import { Hono } from 'hono'
import { createServer, IncomingMessage } from 'http'
import type { Socket } from 'net'
import { WebSocketServer, WebSocket, RawData } from 'ws'
import type { BoxState, ServerMessage, ClientMessage } from './types'

const PORT = 8080

// --- Hono App ---
const app = new Hono()
app.get('/healthz', (c) => c.text('ok'))

// --- Mini-Adapter: Node req/res -> Fetch Request ---
function handler(req: IncomingMessage, res: any) {
    const url = new URL(req.url || '/', `http://${req.headers.host}`)
    const method = req.method || 'GET'

    // Body nur bei Nicht-GET/HEAD durchreichen
    const body =
        method !== 'GET' && method !== 'HEAD' ? (req as any) : undefined

    // Node-Header -> Fetch-Headers
    const headers = new Headers()
    for (const [k, v] of Object.entries(req.headers)) {
        if (Array.isArray(v)) v.forEach((vv) => headers.append(k, vv))
        else if (v != null) headers.set(k, String(v))
    }

    // @ts-expect-error duplex für Node Streams
    const request = new Request(url, { method, headers, body, duplex: 'half' })

    app
        .fetch(request)
        .then(async (r) => {
            res.statusCode = r.status
            r.headers.forEach((value, key) => res.setHeader(key, value))
            const ab = await r.arrayBuffer()
            res.end(Buffer.from(ab))
        })
        .catch((err) => {
            console.error(err)
            res.statusCode = 500
            res.end('Internal Server Error')
        })
}

// Node-HTTP-Server erstellen (ohne toNodeListener)
const server = createServer(handler)
server.listen(PORT, () => console.log(`[cakeboxes] http/ws on :${PORT}`))

// --- WebSocket-Server ---
const wss = new WebSocketServer({ noServer: true })

let boxes: BoxState = [true, true, true, true, true]

function broadcastState() {
    const msg: ServerMessage = { type: 'state', boxes }
    const data = JSON.stringify(msg)
    wss.clients.forEach((c) => {
        if (c.readyState === WebSocket.OPEN) c.send(data)
    })
}

server.on('upgrade', (req, socket: Socket, head) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (url.pathname !== '/ws') {
        socket.destroy()
        return
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req)
    })
})

wss.on('connection', (ws: WebSocket) => {
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
