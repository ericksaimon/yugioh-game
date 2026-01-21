const http = require("http");
const WebSocket = require("ws");
const { randomUUID } = require("crypto");

const PORT = process.env.PORT || 3001;

// HTTP server (Railway healthcheck)
const server = http.createServer((req, res) => {
  if (req.url === "/" || req.url === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("OK");
    return;
  }
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not Found");
});

// WebSocket em cima do mesmo HTTP server
const wss = new WebSocket.Server({ server });

console.log(`✅ HTTP+WS iniciando... PORT=${PORT}`);

// Estado
const clients = new Map();
const queueByRoom = new Map();
const matches = new Map();

function send(ws, obj) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(obj));
}

function broadcastMatch(matchId, obj) {
  const m = matches.get(matchId);
  if (!m) return;
  send(m.p1, obj);
  send(m.p2, obj);
}

function ensureQueue(roomId) {
  if (!queueByRoom.has(roomId)) queueByRoom.set(roomId, []);
  return queueByRoom.get(roomId);
}

function removeFromQueues(ws) {
  for (const [roomId, arr] of queueByRoom.entries()) {
    const idx = arr.indexOf(ws);
    if (idx !== -1) {
      arr.splice(idx, 1);
      if (arr.length === 0) queueByRoom.delete(roomId);
    }
  }
}

function cleanupClient(ws) {
  const c = clients.get(ws);
  if (!c) return;

  removeFromQueues(ws);

  if (c.matchId) {
    const m = matches.get(c.matchId);
    if (m) {
      const other = m.p1 === ws ? m.p2 : m.p1;
      send(other, { type: "MATCH_CANCELLED", reason: "opponent_left" });
      send(other, { type: "VIEW", view: "lobby" });

      matches.delete(c.matchId);

      const otherC = clients.get(other);
      if (otherC) otherC.matchId = null;
    }
  }
  clients.delete(ws);
}

function tryMatch(roomId) {
  const q = ensureQueue(roomId);

  // remove mortos
  for (let i = q.length - 1; i >= 0; i--) {
    if (!q[i] || q[i].readyState !== WebSocket.OPEN) q.splice(i, 1);
  }

  if (q.length < 2) return;

  const p1 = q.shift();
  const p2 = q.shift();
  if (!p1 || !p2) return;

  const c1 = clients.get(p1);
  const c2 = clients.get(p2);
  if (!c1 || !c2) return;

  if (c1.matchId || c2.matchId) return;

  const matchId = randomUUID();
  c1.matchId = matchId;
  c2.matchId = matchId;

  matches.set(matchId, { p1, p2, roomId, rps: {} });

  send(p1, { type: "VIEW", view: "found" });
  send(p2, { type: "VIEW", view: "found" });

  send(p1, {
    type: "MATCH_FOUND",
    matchId,
    roomId,
    host: "AUTO",
    port: 0,
    you: { userId: c1.userId, username: c1.username },
    opponent: { userId: c2.userId, username: c2.username }
  });

  send(p2, {
    type: "MATCH_FOUND",
    matchId,
    roomId,
    host: "AUTO",
    port: 0,
    you: { userId: c2.userId, username: c2.username },
    opponent: { userId: c1.userId, username: c1.username }
  });

  send(p1, { type: "VIEW", view: "rps" });
  send(p2, { type: "VIEW", view: "rps" });
}

wss.on("connection", (ws) => {
  clients.set(ws, {
    userId: null,
    username: "Duelista",
    roomId: null,
    matchId: null
  });

  send(ws, { type: "VIEW", view: "lobby" });

  ws.on("message", (buf) => {
    let msg = null;
    try { msg = JSON.parse(buf.toString()); } catch {}
    if (!msg?.type) return;

    const c = clients.get(ws);
    if (!c) return;

    if (msg.type === "SET_USER") {
      c.userId = msg.userId || c.userId;
      c.username = msg.username || "Duelista";
      send(ws, { type: "USER", username: c.username });
      send(ws, { type: "VIEW", view: "lobby" });
      return;
    }

    if (msg.type === "FIND_MATCH" || msg.type === "MATCHMAKE") {
      const roomId = msg.roomId || "random_free";
      c.roomId = roomId;

      removeFromQueues(ws);
      c.matchId = null;

      send(ws, { type: "VIEW", view: "searching" });

      const q = ensureQueue(roomId);
      if (!q.includes(ws)) q.push(ws);

      tryMatch(roomId);
      return;
    }

    if (msg.type === "CANCEL_MATCHMAKE") {
      removeFromQueues(ws);
      c.roomId = null;
      send(ws, { type: "VIEW", view: "lobby" });
      return;
    }

    if (msg.type === "RPS") {
      if (!c.matchId) return;

      const match = matches.get(c.matchId);
      if (!match) return;

      const key = c.userId || c.username;
      match.rps[key] = msg.choice;

      const c1 = clients.get(match.p1);
      const c2 = clients.get(match.p2);
      if (!c1 || !c2) return;

      const have1 = match.rps[c1.userId || c1.username];
      const have2 = match.rps[c2.userId || c2.username];

      if (have1 && have2) {
        broadcastMatch(c.matchId, { type: "VIEW", view: "duel" });
        broadcastMatch(c.matchId, { type: "DUEL_READY", matchId: c.matchId, roomId: match.roomId });
      }
    }
  });

  ws.on("close", () => cleanupClient(ws));
  ws.on("error", () => cleanupClient(ws));
});

// ping keepalive
setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.readyState === WebSocket.OPEN) {
      try { ws.ping(); } catch {}
    }
  }
}, 25000);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Listening on 0.0.0.0:${PORT}`);
});
