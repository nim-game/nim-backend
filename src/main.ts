// server.ts (ESM) — Hono + SSE
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { cors } from 'hono/cors'
import { streamSSE } from 'hono/streaming'

// --- Typen ---
type BoxState = boolean[]
type ServerMessage = { type: 'state'; boxes: BoxState }

// In-Memory State
let boxes: BoxState = [true, true, true, true, true]

// Verbundene Clients (SSE-Push-Funktionen)
type Client = { push: (msg: ServerMessage) => Promise<void> | void }
const clients = new Set<Client>()

function broadcast() {
    const msg: ServerMessage = { type: 'state', boxes }
    for (const c of clients) c.push(msg)
}

const app = new Hono()

// CORS global aktivieren (für Dev)
app.use('*', cors())

// Healthcheck
app.get('/healthz', c => c.text('ok'))

// Server-Sent Events
app.get('/events', c =>
    streamSSE(c, async (stream) => {
        // Client registrieren
        const client: Client = {
            push: (msg: ServerMessage) => stream.writeSSE({ data: JSON.stringify(msg) })
        }
        clients.add(client)

        // Initialer Zustand
        await client.push({ type: 'state', boxes })

        // Heartbeat (alternativ: Kommentar mit stream.write(': ping\\n\\n'))
        const hb = setInterval(() => {
            // Eventname "ping" – viele EventSource-Clients ignorieren fehlende data entspannt
            stream.writeSSE({ event: 'ping', data: '' })
        }, 15000)

        // Auf Verbindungsende reagieren
        const abort = () => {
            clearInterval(hb)
            clients.delete(client)
            try { stream.close() } catch {}
        }
        c.req.raw.signal.addEventListener('abort', abort)
    })
)

// Kiste entfernen
app.post('/remove', async (c) => {
    try {
        const { index } = await c.req.json<{ index: number }>()
        if (Number.isInteger(index) && boxes[index]) {
            boxes[index] = false
            broadcast()
        }
        return c.text('ok')
    } catch {
        return c.text('bad', 400)
    }
})

// Reset
app.post('/reset', (c) => {
    boxes = [true, true, true, true, true]
    broadcast()
    return c.text('ok')
})

// Root (optional)
app.get('/', c => c.text('cakeboxes Hono API up'))

// Start
const port = 3000
console.log(`[cakeboxes] http/sse on :${port}`)
serve({ fetch: app.fetch, port })
