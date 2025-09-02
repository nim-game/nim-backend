import express, { type Request, type Response } from 'express';
import { WebSocketServer, WebSocket, RawData } from 'ws';
import type { IncomingMessage } from 'http';
import type { Socket } from 'net';
import type { BoxState, ServerMessage, ClientMessage } from './types';


const PORT = 8000;

const app = express();
const main = app.listen(PORT, () => console.log(`[cakeboxes] http/ws on :${PORT}`));


// In-Memory State (ein Pod => reicht für MVP). Für Production: Redis pub/sub.
let boxes: BoxState = [true, true, true, true, true];


app.get('/healthz', (_req: Request, res: Response) => res.status(200).send('ok'));


const wss = new WebSocketServer({ noServer: true });


main.on('upgrade', (req: IncomingMessage, socket: Socket, head: Buffer) => {
    if (req.url !== '/ws') {
        socket.destroy();
        return;
    }
    wss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
        wss.emit('connection', ws, req);
    });
});


function broadcastState() {
    const msg: ServerMessage = { type: 'state', boxes };
    const data = JSON.stringify(msg);
    wss.clients.forEach((c) => {
        if ((c as WebSocket).readyState === WebSocket.OPEN) (c as WebSocket).send(data);
    });
}


wss.on('connection', (ws: WebSocket) => {
// Beim Connect: aktuellen Zustand schicken
    ws.send(JSON.stringify({ type: 'state', boxes } satisfies ServerMessage));


    ws.on('message', (raw: RawData) => {
        try {
            const msg = JSON.parse(String(raw)) as ClientMessage;
            if (msg.type === 'remove') {
                if (msg.index >= 0 && msg.index < boxes.length && boxes[msg.index]) {
                    boxes[msg.index] = false;
                    broadcastState();
                }
            } else if (msg.type === 'reset') {
                boxes = [true, true, true, true, true];
                broadcastState();
            }
        } catch (e) {
// ignore bad input
        }
    });
});