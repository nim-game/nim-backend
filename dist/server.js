"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const ws_1 = require("ws");
const PORT = Number(process.env.PORT || 8080);
const app = (0, express_1.default)();
const server = app.listen(PORT, () => console.log(`[cakeboxes] http/ws on :${PORT}`));
// In-Memory State (ein Pod => reicht für MVP). Für Production: Redis pub/sub.
let boxes = [true, true, true, true, true];
app.get('/healthz', (_req, res) => res.status(200).send('ok'));
const wss = new ws_1.WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
    if (req.url !== '/ws') {
        socket.destroy();
        return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
    });
});
function broadcastState() {
    const msg = { type: 'state', boxes };
    const data = JSON.stringify(msg);
    wss.clients.forEach((c) => {
        if (c.readyState === 1)
            c.send(data);
    });
}
wss.on('connection', (ws) => {
    // Beim Connect: aktuellen Zustand schicken
    ws.send(JSON.stringify({ type: 'state', boxes }));
    ws.on('message', (raw) => {
        try {
            const msg = JSON.parse(String(raw));
            if (msg.type === 'remove') {
                if (msg.index >= 0 && msg.index < boxes.length && boxes[msg.index]) {
                    boxes[msg.index] = false;
                    broadcastState();
                }
            }
            else if (msg.type === 'reset') {
                boxes = [true, true, true, true, true];
                broadcastState();
            }
        }
        catch (e) {
            // ignore bad input
        }
    });
});
