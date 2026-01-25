"use strict";

const http = require("http");
const { URL } = require("url");
const WebSocket = require("ws");
const { randomUUID, randomBytes, timingSafeEqual, createHash } = require("crypto");

const { createClient } = require("@supabase/supabase-js");

// ====================== ENV / PORT ======================
const PORT = Number(process.env.PORT || 8080);
const HOST = "0.0.0.0";

const DEFAULT_PUBLIC_HOST =
  process.env.PUBLIC_HOST ||
  (process.env.FLY_APP_NAME ? `${process.env.FLY_APP_NAME}.fly.dev` : "localhost");

const DUEL_HOST = process.env.DUEL_HOST || DEFAULT_PUBLIC_HOST;
const DUEL_PORT = Number(process.env.DUEL_PORT || 7911);
const DUEL_PASS = process.env.DUEL_PASS || "";

// ✅ CHANGE: controla se a key é "one-time" ou "reusable até expirar"
// - Para permitir reentrar e evitar 401 por retries, o padrão agora é REUSABLE.
// - Se você quiser voltar ao modo antigo (one-time), seta env JOIN_KEY_ONE_TIME=true
const JOIN_KEY_ONE_TIME = String(process.env.JOIN_KEY_ONE_TIME || "false").toLowerCase() === "true";

// ✅ CHANGE: TTL padrão maior (rejoin é útil). Você pode ajustar por env.
const JOIN_KEY_TTL_MS = Number(process.env.JOIN_KEY_TTL_MS || 30 * 60_000); // 30 min

// ====================== SUPABASE ======================
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE;

if (!supabaseUrl || !serviceRole) {
  throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE faltando no env");
}

const supabase = createClient(supabaseUrl, serviceRole, {
  auth: { persistSession: false },
});

// ====================== IN-MEMORY STORE (mantido) ======================
const joinKeys = new Map(); // cache opcional (não depende mais dele)
const clients = new Map(); // ws -> { userId, username, roomId, matchId }
const queueByRoom = new Map(); // roomId -> [ws, ws]
const matches = new Map(); // matchId -> { p1, p2, roomId }

function makeJoinKey() {
  return randomBytes(16).toString("base64url");
}
function hashKeyHex(key) {
  return createHash("sha256").update(key).digest("hex");
}
function hashKeyBufFromHex(hex) {
  return Buffer.from(hex, "hex");
}

// ====================== DB HELPERS (NOVO) ======================
async function dbUpsertMatch({ matchId, roomId, p1uid, p2uid }) {
  // guarda match para rejoin sobreviver restart
  const payload = {
    id: matchId,
    room_id: String(roomId || "match"), // ✅ CHANGE: antes você tava passando matchId no lugar do roomId
    p1_uid: String(p1uid || ""),
    p2_uid: String(p2uid || ""),
    duel_host: DUEL_HOST,
    duel_port: DUEL_PORT,
    duel_pass: DUEL_PASS,
    status: "running", // ✅ CHANGE: "running" fica mais correto pra rejoin
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("matches").upsert(payload, { onConflict: "id" });
  if (error) console.warn("⚠️ upsert matches failed:", error.message);
}

async function dbCheckJoinKey(matchId, userId, rawKey) {
  const { data, error } = await supabase
    .from("match_join_keys")
    .select("key_hash, expires_at")
    .eq("match_id", matchId)
    .eq("user_id", String(userId))
    .maybeSingle();

  if (error) return { ok: false, reason: "db_error" };
  if (!data) return { ok: false, reason: "missing" };

  const exp = new Date(data.expires_at).getTime();
  if (Date.now() > exp) return { ok: false, reason: "expired" };

  const providedHex = hashKeyHex(rawKey);
  const a = hashKeyBufFromHex(providedHex);
  const b = hashKeyBufFromHex(data.key_hash);

  if (a.length !== b.length) return { ok: false, reason: "bad_len" };
  const ok = timingSafeEqual(a, b);

  return ok ? { ok: true } : { ok: false, reason: "bad" };
}

async function dbPutJoinKey(matchId, userId, rawKey, ttlMs = JOIN_KEY_TTL_MS) {
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  const keyHash = hashKeyHex(rawKey);

  // mantém cache local (não é obrigatório)
  joinKeys.set(`${matchId}:${userId}`, { keyHash: hashKeyBufFromHex(keyHash), expiresAt: Date.now() + ttlMs });

  const { error } = await supabase
    .from("match_join_keys")
    .upsert(
      { match_id: matchId, user_id: String(userId), key_hash: keyHash, expires_at: expiresAt },
      { onConflict: "match_id,user_id" }
    );

  if (error) console.warn("⚠️ upsert match_join_keys failed:", error.message);
}

// ✅ CHANGE: agora valida SEMPRE pelo DB e NÃO consome por padrão (reusable até expirar)
// Isso evita:
// - 401 por retry de rede
// - 401 porque abriu/fechou launcher e tentou de novo
// - dá suporte ao REJOIN real
async function dbConsumeJoinKey(matchId, userId, rawKey) {
  // 1) tenta DB (principal)
  const { data, error } = await supabase
    .from("match_join_keys")
    .select("key_hash, expires_at")
    .eq("match_id", matchId)
    .eq("user_id", String(userId))
    .maybeSingle();

  if (error) return { ok: false, reason: "db_error" };
  if (!data) return { ok: false, reason: "missing" };

  const exp = new Date(data.expires_at).getTime();
  if (Date.now() > exp) {
    // expirou -> remove
    await supabase.from("match_join_keys").delete().eq("match_id", matchId).eq("user_id", String(userId));
    joinKeys.delete(`${matchId}:${userId}`);
    return { ok: false, reason: "expired" };
  }

  const providedHex = hashKeyHex(rawKey);
  const a = hashKeyBufFromHex(providedHex);
  const b = hashKeyBufFromHex(data.key_hash);

  if (a.length !== b.length) return { ok: false, reason: "bad_len" };
  const ok = timingSafeEqual(a, b);
  if (!ok) return { ok: false, reason: "bad" };

  // ✅ CHANGE: NÃO deletar por padrão (rejoin)
  // Se quiser "one-time key", habilita env JOIN_KEY_ONE_TIME=true
  if (JOIN_KEY_ONE_TIME) {
    await supabase.from("match_join_keys").delete().eq("match_id", matchId).eq("user_id", String(userId));
    joinKeys.delete(`${matchId}:${userId}`);
  }

  return { ok: true };
}

async function dbGetMatch(matchId) {
  const { data, error } = await supabase
    .from("matches")
    .select("id, room_id, p1_uid, p2_uid, duel_host, duel_port, duel_pass, status")
    .eq("id", matchId)
    .maybeSingle();

  if (error) return null;
  return data || null;
}

// ✅ NOVO (sem quebrar): resolve profile com o schema REAL (firebase_uid) e fallback opcional
// - seu banco: profiles.firebase_uid (text, NOT NULL)
// - não existe profiles.id / profiles.user_id etc.
async function fetchProfileByAnyKey(userId) {
  // a gente tenta primeiro pelo schema real:
  const selectBase = "firebase_uid, username, team_tag, level, avatar_url, wizard_money";

  // 1) caminho principal (correto pro seu banco)
  let r = await supabase.from("profiles").select(selectBase).eq("firebase_uid", userId).maybeSingle();
  if (r.data) return { data: r.data, error: null, matchedCol: "firebase_uid" };
  if (r.error && !String(r.error.message || "").toLowerCase().includes("does not exist")) {
    return { data: null, error: r.error, matchedCol: "firebase_uid" };
  }

  // 2) fallback (mantido “sem quebrar”, caso você mude schema no futuro)
  const candidates = ["id", "user_id", "uid", "auth_uid", "user_uid", "owner_id"];
  for (const col of candidates) {
    const rr = await supabase.from("profiles").select(selectBase).eq(col, userId).maybeSingle();

    if (rr.data) return { data: rr.data, error: null, matchedCol: col };

    // se coluna não existe, tenta próxima
    if (rr.error && String(rr.error.message || "").toLowerCase().includes("does not exist")) continue;

    // erro real
    if (rr.error) return { data: null, error: rr.error, matchedCol: col };
  }

  return { data: null, error: null, matchedCol: null };
}

// ✅ NOVO (sem quebrar): pega deck equipado do usuário pelo schema REAL
// - seu banco: decks.firebase_uid + decks.is_equipped + decks.name
// - não existe decks.ydk_text (por enquanto)
async function fetchEquippedDeck(userId) {
  // 1) caminho principal (correto)
  const r = await supabase
    .from("decks")
    .select("id, name, firebase_uid, is_equipped")
    .eq("firebase_uid", String(userId))
    .eq("is_equipped", true)
    .maybeSingle();

  if (r.error) {
    // se colunas não existirem (futuro), a gente só devolve null sem derrubar
    if (String(r.error.message || "").toLowerCase().includes("does not exist")) {
      return { data: null, error: null };
    }
    return { data: null, error: r.error };
  }

  if (!r.data) return { data: null, error: null };

  // mantém o formato que o launcher espera (ydkText pode vir vazio por enquanto)
  return {
    data: { id: r.data.id, name: r.data.name, ydkText: "" },
    error: null,
  };
}

// limpeza de keys expiradas (mantida + agora também limpa no DB)
setInterval(async () => {
  const now = Date.now();

  // cache local
  for (const [k, v] of joinKeys.entries()) {
    if (now > v.expiresAt) joinKeys.delete(k);
  }

  // db
  try {
    await supabase.from("match_join_keys").delete().lt("expires_at", new Date().toISOString());
  } catch {}
}, 60_000).unref();

// ====================== HTTP SERVER (API + health) ======================
const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, `http://${req.headers.host}`);

    if (u.pathname === "/" || u.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      return res.end("OK");
    }

    // -------- API: /api/match/config --------
    if (u.pathname === "/api/match/config" && req.method === "GET") {
      const matchId = (u.searchParams.get("matchId") || "").trim();
      const userId = (u.searchParams.get("userId") || "").trim();
      const key = (u.searchParams.get("key") || "").trim();

      if (!matchId || !userId || !key) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "missing matchId/userId/key" }));
      }

      // ✅ valida (agora sem consumir por padrão)
      const keyCheck = await dbConsumeJoinKey(matchId, userId, key);
      if (!keyCheck.ok) {
        res.writeHead(401, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "invalid_or_expired_key", reason: keyCheck.reason }));
      }

      // pega match: tenta memória (mantido), senão DB (novo)
      let m = matches.get(matchId);
      let dbMatch = null;

      if (!m) {
        dbMatch = await dbGetMatch(matchId);
        if (!dbMatch) {
          res.writeHead(404, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ error: "match_not_found" }));
        }
      }

      // determina room e oponentes (melhor esforço)
      const roomId = m?.roomId || dbMatch?.room_id || "match";

      // tenta inferir opponent do DB
      let opponentUserId = "";
      if (dbMatch) {
        if (dbMatch.p1_uid === userId) opponentUserId = dbMatch.p2_uid;
        else if (dbMatch.p2_uid === userId) opponentUserId = dbMatch.p1_uid;
      } else {
        const c1 = clients.get(m.p1);
        const c2 = clients.get(m.p2);
        const youIsP1 = c1?.userId === userId;
        const opp = youIsP1 ? c2 : c1;
        opponentUserId = opp?.userId || "";
      }

      // ====================== PERFIL (AJUSTADO AO SEU SCHEMA) ======================
      const prof = await fetchProfileByAnyKey(userId);

      if (prof.error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "profile_query_failed", details: prof.error.message }));
      }

      if (!prof.data) {
        res.writeHead(404, { "Content-Type": "application/json" });
        return res.end(
          JSON.stringify({
            error: "profile_not_found",
            details: "No profile row matched this userId",
            tried: ["firebase_uid", "id", "user_id", "uid", "auth_uid", "user_uid", "owner_id"],
          })
        );
      }

      const profile = prof.data;

      // ====================== DECK (AJUSTADO AO SEU SCHEMA) ======================
      // Mantém o campo equippedDeck no payload (não deletado), só muda a forma de buscar.
      let deck = null;
      const deckRes = await fetchEquippedDeck(userId);
      if (deckRes.error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "deck_query_failed", details: deckRes.error.message }));
      }
      if (deckRes.data) deck = deckRes.data;

      const duelHost = dbMatch?.duel_host || DUEL_HOST;
      const duelPort = Number(dbMatch?.duel_port || DUEL_PORT);
      const duelPass = String(dbMatch?.duel_pass ?? DUEL_PASS ?? "");

      const payload = {
        match: {
          id: matchId,
          duelHost,
          duelPort,
          room: roomId,
          roomId: roomId, // ✅ compat extra para alguns launchers
          pass: duelPass,
          status: dbMatch?.status || "running",
        },

        you: {
          id: userId,
          username: profile?.username || "Duelista",
          teamTag: profile?.team_tag || "",
          level: profile?.level ?? 1,
          avatarUrl: profile?.avatar_url || "",
          wizardMoney: profile?.wizard_money ?? 0,
          equippedDeck: deck
            ? { id: deck.id, name: deck.name, ydkText: deck.ydkText || "" }
            : { id: "", name: "", ydkText: "" },
        },
        opponent: {
          userId: opponentUserId || "",
          username: "",
        },
        // ✅ CHANGE: ajuda debug no launcher sem quebrar nada
        meta: {
          joinKeyOneTime: JOIN_KEY_ONE_TIME,
          joinKeyTtlMs: JOIN_KEY_TTL_MS,
          profileMatchedCol: prof.matchedCol || null,
        },
      };

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(payload));
    }

    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("OK");
  } catch (e) {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("ERR");
  }
});

// ====================== WS ======================
const wss = new WebSocket.Server({ server });

function send(ws, obj) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(obj));
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

async function tryMatch(roomId) {
  const q = ensureQueue(roomId);

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

  if (!c1.userId || !c2.userId) {
    send(p1, { type: "ERROR", message: "SET_USER required" });
    send(p2, { type: "ERROR", message: "SET_USER required" });
    return;
  }

  const matchId = randomUUID();
  c1.matchId = matchId;
  c2.matchId = matchId;

  matches.set(matchId, { p1, p2, roomId });

  // ✅ salva match no DB (novo)
  // ✅ CHANGE: agora roomId correto
  await dbUpsertMatch({ matchId, roomId, p1uid: c1.userId, p2uid: c2.userId });

  // cria joinKey por jogador (agora salva no DB)
  const key1 = makeJoinKey();
  const key2 = makeJoinKey();
  await dbPutJoinKey(matchId, c1.userId, key1, JOIN_KEY_TTL_MS); // ✅ CHANGE TTL
  await dbPutJoinKey(matchId, c2.userId, key2, JOIN_KEY_TTL_MS); // ✅ CHANGE TTL

  // ✅ CHANGE: api deve bater com o que o launcher usa
  const apiBase = `https://${DEFAULT_PUBLIC_HOST}`;

  send(p1, {
    type: "MATCH_FOUND",
    matchId,
    roomId,
    api: apiBase,
    joinKey: key1,
    you: { userId: c1.userId, username: c1.username },
    opponent: { userId: c2.userId, username: c2.username },
  });

  send(p2, {
    type: "MATCH_FOUND",
    matchId,
    roomId,
    api: apiBase,
    joinKey: key2,
    you: { userId: c2.userId, username: c2.username },
    opponent: { userId: c1.userId, username: c1.username },
  });

  send(p1, { type: "VIEW", view: "duel" });
  send(p2, { type: "VIEW", view: "duel" });
}

wss.on("connection", (ws) => {
  clients.set(ws, { userId: null, username: "Duelista", roomId: null, matchId: null });
  send(ws, { type: "VIEW", view: "lobby" });

  ws.on("message", async (buf) => {
    let msg;
    try {
      msg = JSON.parse(buf.toString());
    } catch {
      return;
    }
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

      await tryMatch(roomId);
      return;
    }

    if (msg.type === "CANCEL_MATCHMAKE") {
      removeFromQueues(ws);
      c.roomId = null;
      send(ws, { type: "VIEW", view: "lobby" });
      return;
    }

    // ✅ NOVO: pedir joinKey pra rejoin
    if (msg.type === "REQUEST_JOIN_KEY") {
      const matchId = (msg.matchId || "").trim();
      if (!matchId || !c.userId) {
        send(ws, { type: "ERROR", message: "REQUEST_JOIN_KEY missing matchId/userId" });
        return;
      }

      const dbMatch = await dbGetMatch(matchId);
      if (!dbMatch) {
        send(ws, { type: "ERROR", message: "match_not_found" });
        return;
      }

      // garante que esse user faz parte do match
      const okMember = dbMatch.p1_uid === c.userId || dbMatch.p2_uid === c.userId;
      if (!okMember) {
        send(ws, { type: "ERROR", message: "not_in_match" });
        return;
      }

      // gera joinKey nova (renovável)
      const newKey = makeJoinKey();
      await dbPutJoinKey(matchId, c.userId, newKey, JOIN_KEY_TTL_MS); // ✅ CHANGE TTL

      send(ws, {
        type: "JOIN_KEY",
        matchId,
        api: `https://${DEFAULT_PUBLIC_HOST}`,
        joinKey: newKey,
        roomId: dbMatch.room_id || "random_free",
        you: { userId: c.userId, username: c.username },
      });
      return;
    }
  });

  ws.on("close", () => cleanupClient(ws));
  ws.on("error", () => cleanupClient(ws));
});

// keepalive
setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.ping();
      } catch {}
    }
  }
}, 25000).unref();

server.listen(PORT, HOST, () => {
  console.log(`✅ HTTP+WS iniciando... HOST=${HOST} PORT=${PORT}`);
  console.log(`✅ DUEL_HOST=${DUEL_HOST} DUEL_PORT=${DUEL_PORT}`);
  console.log(`✅ Listening on ${HOST}:${PORT}`);
  console.log(`✅ JOIN_KEY_ONE_TIME=${JOIN_KEY_ONE_TIME} TTL_MS=${JOIN_KEY_TTL_MS}`); // ✅ CHANGE
});
