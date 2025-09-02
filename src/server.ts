import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { cors } from 'hono/cors'
import { WebSocketServer, WebSocket } from 'ws'
import type { IncomingMessage } from 'http'
import type { Socket } from 'net'

const app = new Hono()
app.use('*', cors())

app.get('/healthz', (c) => c.text('ok'))
app.get('/', (c) => c.text('Mock API is running!'))
app.get('/api/news', (c) => c.json([{ id: 1, title: 'Hello from mock API (Hono)' }]))
app.get('/api/grades', (c) => c.json([{ course: 'Math', grade: '1.7' }]))

const PORT = Number(process.env.PORT || 3000)
const server = serve({ fetch: app.fetch, port: PORT })
console.log(`[hono] http/ws on :${PORT}`)

const wss = new WebSocketServer({ noServer: true })
let boxes = [true, true, true, true, true]

function broadcastState() {
    const data = JSON.stringify({ type: 'state', boxes })
    for (const c of wss.clients) if (c.readyState === WebSocket.OPEN) c.send(data)
}

wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'state', boxes }))
    ws.on('message', (raw) => {
        try {
            const msg = JSON.parse(String(raw))
            if (msg.type === 'remove' && boxes[msg.index]) { boxes[msg.index] = false; broadcastState() }
            if (msg.type === 'reset') { boxes = [true, true, true, true, true]; broadcastState() }
        } catch {}
    })
})

server.on('upgrade', (req: IncomingMessage, socket: Socket, head: Buffer) => {
    if (req.url !== '/ws') { socket.destroy(); return }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req))
})
