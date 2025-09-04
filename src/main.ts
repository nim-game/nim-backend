// server.ts – ESM-kompatibel

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { setInterval, clearInterval } from "node:timers";

// --- Typen ---
type BoxState = boolean[];
type ServerMessage = { type: "state"; boxes: BoxState };

// In-Memory State
let boxes: BoxState = [true, true, true, true, true];

// Verbundene Clients (halten SSE-Verbindung)
const clients = new Set<ServerResponse>();

function sse(res: ServerResponse) {
    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*", // für Dev
    });
    clients.add(res);

    // Initialer Zustand
    res.write(`data: ${JSON.stringify({ type: "state", boxes })}\n\n`);

    // Heartbeat
    const hb = setInterval(() => res.write(`: ping\n\n`), 15000);

    res.on("close", () => {
        clearInterval(hb);
        clients.delete(res);
    });
}

function broadcast() {
    const data = `data: ${JSON.stringify({ type: "state", boxes } satisfies ServerMessage)}\n\n`;
    for (const c of clients) c.write(data);
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // CORS preflight
    if (req.method === "OPTIONS") {
        res.writeHead(204, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        });
        return res.end();
    }

    if (req.url === "/events" && req.method === "GET") return sse(res);

    if (req.url === "/remove" && req.method === "POST") {
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
            try {
                const { index } = JSON.parse(body) as { index: number };
                if (Number.isInteger(index) && boxes[index]) boxes[index] = false;
                res.writeHead(200, { "Access-Control-Allow-Origin": "*" }).end("ok");
                broadcast();
            } catch {
                res.writeHead(400).end("bad");
            }
        });
        return;
    }

    if (req.url === "/reset" && req.method === "POST") {
        boxes = [true, true, true, true, true];
        res.writeHead(200, { "Access-Control-Allow-Origin": "*" }).end("ok");
        broadcast();
        return;
    }

    if (req.url === "/healthz") return res.writeHead(200).end("ok");

    res.writeHead(404).end("not found");
});

server.listen(3000, () => console.log("[cakeboxes] http/sse on :8000"));
