const WebSocket = require("ws");
const { randomUUID } = require("crypto");

// ✅ Railway fornece PORT automaticamente
const PORT = process.env.PORT || 3001;
const wss = new WebSocket.Server({ port: PORT });

console.log(`✅ WS Server rodando na porta ${PORT}`);

// -------------------- Estado em memória --------------------
/**
 * clients: ws -> { userId, username, roomId, matchId }
 * queueByRoom: roomId -> [ws, ws, ...]
 * matches: matchId -> { p1: ws, p2: ws, roomId, rps: {key: choice} }
 */
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

  // remove de fila
  removeFromQueues(ws);

  // se estava em match, avisa o outro
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

  // remove sockets mortos da fila
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

  // ✅ não permite se um dos dois já estiver em match
  if (c1.matchId || c2.matchId) return;

  const matchId = randomUUID();
  c1.matchId = matchId;
  c2.matchId = matchId;

  matches.set(matchId, { p1, p2, roomId, rps: {} });

  // manda pros dois
  send(p1, { type: "VIEW", view: "found" });
  send(p2, { type: "VIEW", view: "found" });

  send(p1, {
    type: "MATCH_FOUND",
    matchId,
    roomId,
    // ✅ por enquanto: mesmo servidor WS como host “lógico”
    // (depois a gente troca para IP/porta do host do duelo no EDOPro)
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

  // ✅ Se você quiser pular RPS e já iniciar, faça aqui.
  // Por enquanto, vamos manter RPS:
  send(p1, { type: "VIEW", view: "rps" });
  send(p2, { type: "VIEW", view: "rps" });
}

wss.on("connection", (ws) => {
  console.log("Cliente conectado");

  // ✅ cria estado do cliente
  clients.set(ws, {
    userId: null,
    username: "Duelista",
    roomId: null,
    matchId: null
  });

  // estado inicial compatível com seu App atual
  send(ws, { type: "VIEW", view: "lobby" });

  ws.on("message", (buf) => {
    const raw = buf.toString();
    let msg = null;
    try { msg = JSON.parse(raw); } catch {}
    if (!msg?.type) return;

    const c = clients.get(ws);
    if (!c) return;

    // ------------------ SET_USER ------------------
    if (msg.type === "SET_USER") {
      c.userId = msg.userId || c.userId; // opcional
      c.username = msg.username || "Duelista";
      send(ws, { type: "USER", username: c.username });
      send(ws, { type: "VIEW", view: "lobby" });
      return;
    }

    // ------------------ FIND_MATCH (do seu App novo) ------------------
    if (msg.type === "FIND_MATCH") {
      const roomId = msg.roomId || "random_free";
      c.roomId = roomId;

      // limpa estados anteriores
      removeFromQueues(ws);
      c.matchId = null;

      // entra em searching
      send(ws, { type: "VIEW", view: "searching" });

      const q = ensureQueue(roomId);
      if (!q.includes(ws)) q.push(ws);

      tryMatch(roomId);
      return;
    }

    // ------------------ MATCHMAKE (se você ainda usar em algum lugar) ------------------
    if (msg.type === "MATCHMAKE") {
      const roomId = msg.roomId || "random_free";
      const username = msg.username || c.username || "Duelista";

      removeFromQueues(ws);
      c.matchId = null;

      c.roomId = roomId;
      c.username = username;

      send(ws, { type: "VIEW", view: "searching" });

      const q = ensureQueue(roomId);
      if (!q.includes(ws)) q.push(ws);

      tryMatch(roomId);
      return;
    }

    // ------------------ CANCEL ------------------
    if (msg.type === "CANCEL_MATCHMAKE") {
      removeFromQueues(ws);
      c.roomId = null;
      send(ws, { type: "VIEW", view: "lobby" });
      return;
    }

    // ------------------ RPS ------------------
    if (msg.type === "RPS") {
      if (!c.matchId) return;

      const match = matches.get(c.matchId);
      if (!match) return;

      const key = c.userId || c.username; // identificador
      match.rps[key] = msg.choice;

      const c1 = clients.get(match.p1);
      const c2 = clients.get(match.p2);
      if (!c1 || !c2) return;

      const have1 = match.rps[c1.userId || c1.username];
      const have2 = match.rps[c2.userId || c2.username];

      // quando os 2 escolherem:
      if (have1 && have2) {
        broadcastMatch(c.matchId, { type: "VIEW", view: "duel" });

        // ✅ Aqui depois a gente troca para iniciar o EDOPro de verdade.
        // Por enquanto só sinaliza que o duelo pode começar.
        broadcastMatch(c.matchId, {
          type: "DUEL_READY",
          matchId: c.matchId,
          roomId: match.roomId
        });
      }
      return;
    }
  });

  ws.on("close", () => {
    console.log("Cliente desconectado");
    cleanupClient(ws);
  });

  ws.on("error", () => {
    cleanupClient(ws);
  });
});

// ✅ Keep-alive (Railway/Proxy às vezes derruba conexão idle)
setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.readyState === WebSocket.OPEN) {
      try { ws.ping(); } catch {}
    }
  }
}, 25000);
