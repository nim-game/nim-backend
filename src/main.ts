// server.ts
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { cors } from 'hono/cors'
import { WebSocketServer, WebSocket } from 'ws'
import type { IncomingMessage } from 'http'
import type { Socket } from 'net'

const app = new Hono()

// CORS (für HTTP; WebSockets brauchen kein CORS)
app.use('*', cors())

app.get('/api/news', (c) =>
    c.json([
        { id: 1, title: 'Hello from mock API (Hono)' },
        { id: 2, title: 'Another news item' },
        { id: 3, title: 'More news...' },
    ])
)

app.get('/api/grades', (c) =>
    c.json([
        { course: 'Math', grade: '1.7' },
        { course: 'History', grade: '2.3' },
        { course: 'Science', grade: '1.3' },
        { course: 'Art', grade: '1.0' },
    ])
)

app.get('/healthz', (c) => c.text('ok'))
app.get('/', (c) => c.text('Mock API is running!'))

// Port aus ENV (wichtig für K8s/Helm)
const PORT = Number(process.env.PORT || 3000)

// HTTP-Server starten (wir brauchen die Instanz für "upgrade")
const server = serve({ fetch: app.fetch, port: PORT })
console.log(`[hono] http/ws on :${PORT}`)

// Minimaler WebSocket-Server (ein Endpunkt: /ws)
const wss = new WebSocketServer({ noServer: true })

// Optional: sehr simpler Broadcast
const clients = new Set<WebSocket>()
function broadcast(obj: unknown) {
    const msg = JSON.stringify(obj)
    for (const ws of clients) {
        if (ws.readyState === WebSocket.OPEN) ws.send(msg)
    }
}

// Heartbeat (optional, aber hilft hinter Ingress)
const interval = setInterval(() => {
    for (const ws of clients) {
        // ping -> wenn kein pong kommt, schließt ws automatisch
        ws.ping()
    }
}, 30000)

wss.on('connection', (ws) => {
    clients.add(ws)
    ws.send(JSON.stringify({ type: 'welcome', ts: Date.now() }))

    ws.on('message', (data) => {
        // Echo + Broadcast-Demo
        broadcast({ type: 'message', data: data.toString(), ts: Date.now() })
    })

    ws.on('close', () => {
        clients.delete(ws)
    })
})

server.on('upgrade', (req: IncomingMessage, socket: Socket, head: Buffer) => {
    // nur /ws zulassen
    if (req.url !== '/ws') {
        socket.destroy()
        return
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req)
    })
})
