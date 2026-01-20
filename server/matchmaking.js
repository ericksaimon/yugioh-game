const crypto = require("crypto");

const queues = new Map(); // roomId -> Array<{ userId, ws, profile, deck }>
const matches = new Map(); // matchId -> { roomId, p1, p2, createdAt }

function getQueue(roomId) {
  if (!queues.has(roomId)) queues.set(roomId, []);
  return queues.get(roomId);
}

function removeFromAllQueues(userId) {
  for (const [roomId, q] of queues.entries()) {
    const idx = q.findIndex(x => x.userId === userId);
    if (idx !== -1) q.splice(idx, 1);
  }
}

function createMatch(roomId, a, b) {
  const matchId = crypto.randomBytes(12).toString("hex");

  const match = {
    matchId,
    roomId,
    p1: a,
    p2: b,
    createdAt: Date.now()
  };

  matches.set(matchId, match);

  // avisa os dois
  safeSend(a.ws, { type: "MATCH_FOUND", matchId, roomId, opponent: b.profile, you: a.profile });
  safeSend(b.ws, { type: "MATCH_FOUND", matchId, roomId, opponent: a.profile, you: b.profile });

  // aqui você depois chama o "engine bridge" (Nexus/EDOPro) pra realmente iniciar o duelo.
  // por enquanto só muda view pra duel:
  safeSend(a.ws, { type: "VIEW", view: "duel" });
  safeSend(b.ws, { type: "VIEW", view: "duel" });

  return match;
}

function safeSend(ws, obj) {
  try {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
  } catch {}
}

function enqueue(roomId, entry) {
  const q = getQueue(roomId);

  // não duplica
  if (q.some(x => x.userId === entry.userId)) return { queued: true, position: q.findIndex(x => x.userId === entry.userId) + 1 };

  q.push(entry);

  // se tem 2+, casa imediatamente
  if (q.length >= 2) {
    const a = q.shift();
    const b = q.shift();
    const match = createMatch(roomId, a, b);
    return { queued: false, matchId: match.matchId };
  }

  return { queued: true, position: q.length };
}

module.exports = {
  enqueue,
  removeFromAllQueues,
  matches
};
