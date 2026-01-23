import React, { useEffect, useMemo, useRef, useState } from "react";
import Auth from "./components/Auth";
import { auth } from "./firebase";
import { connectWS, sendWS } from "./ws";
import { signOut, onAuthStateChanged } from "firebase/auth";

type View = "auth" | "lobby" | "searching" | "found" | "error" | "duel";


type RoomId =
  | "random_500"
  | "random_800"
  | "random_1000"
  | "random_1500"
  | "random_free";

type ServerMsg =
  | { type: "AUTH_OK" }
  | { type: "AUTH_FAIL"; reason?: string }
  | { type: "VIEW"; view: View | string }
  | { type: "ERROR"; message: string }
  | {
      type: "MATCH_FOUND";
      matchId: string;
      roomId: RoomId;
      api: string;
      joinKey: string;
      you?: { userId: string; username: string };
      opponent?: { userId: string; username: string };
    }
  | {
      type: "JOIN_KEY";
      matchId: string;
      api: string;
      joinKey: string;
      you?: { userId: string; username: string };
    }
  | { type: "MATCH_CANCELLED"; reason?: string }
  | { type: "USER"; username: string }
  | { type: string; [k: string]: any };

function safeJson(raw: any) {
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ⚠️ mantido (compat), mas no KEY flow host/port não são usados
function canLaunch(host: string, port: number) {
  if (!host) return false;
  if (host === "AUTO") return false;
  if (!Number.isFinite(port) || port <= 0) return false;
  return true;
}

// ✅ launcher (KEY FLOW)
function launchEdopro(params: {
  api: string;
  matchId: string;
  userId: string;
  key: string;
  nick?: string;
  room?: string;
  pass?: string;
}) {
  const link =
    `yugiohcgmd://join` +
    `?api=${encodeURIComponent(params.api)}` +
    `&matchId=${encodeURIComponent(params.matchId)}` +
    `&userId=${encodeURIComponent(params.userId)}` +
    `&key=${encodeURIComponent(params.key)}` +
    (params.nick ? `&nick=${encodeURIComponent(params.nick)}` : "") +
    (params.room ? `&room=${encodeURIComponent(params.room)}` : "") +
    (params.pass ? `&pass=${encodeURIComponent(params.pass)}` : "");

  console.log("🔗 LINK LAUNCHER:", link);
  window.location.href = link;
}

const ROOMS: { id: RoomId; title: string; subtitle: string }[] = [
  { id: "random_500", title: "Random Duel 500", subtitle: "Deck <= 500 WizardMoney" },
  { id: "random_800", title: "Random Duel 800", subtitle: "Deck <= 800 WizardMoney" },
  { id: "random_1000", title: "Random Duel 1000", subtitle: "Deck <= 1000 WizardMoney" },
  { id: "random_1500", title: "Random Duel 1500", subtitle: "Deck <= 1500 WizardMoney" },
  { id: "random_free", title: "Random Duel Livre", subtitle: "Sem limite (BO1)" }
];

const LS_ACTIVE_MATCH = "activeMatchId";

const App: React.FC = () => {
  const [view, setView] = useState<View>("auth");
  const [username, setUsername] = useState<string>("Duelista");
  const [roomId, setRoomId] = useState<RoomId>("random_800");
  const [err, setErr] = useState<string | null>(null);

  const [match, setMatch] = useState<null | {
    matchId: string;

    // mantidos (compat)
    host: string;
    port: number;
    pass?: string;

    // KEY flow
    api?: string;
    joinKey?: string;
    myUserId?: string;

    roomId: RoomId;
    opponentName?: string;
  }>(null);

  // flags (mantidos)
  const didAuthWsRef = useRef(false);

  // bloqueia VIEW=duel por alguns segundos pra não sumir a tela FOUND
  const blockDuelViewUntilRef = useRef(0);

  // auth state (pra evitar “piscar” login)
  const [authReady, setAuthReady] = useState(false);
  const [isLogged, setIsLogged] = useState(false);

  const selectedRoom = useMemo(() => ROOMS.find((r) => r.id === roomId)!, [roomId]);

  // ✅ observa auth do Firebase
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      console.log("AUTH STATE:", {
        uid: u?.uid,
        isAnonymous: (u as any)?.isAnonymous,
        email: u?.email,
        displayName: u?.displayName
      });

      setAuthReady(true);

      if (!u) {
        setIsLogged(false);
        setView("auth");
        setUsername("Duelista");
        didAuthWsRef.current = false;
        return;
      }

      setIsLogged(true);
      setUsername(u.displayName || "Duelista");
      setView("lobby");

      // manda SET_USER assim que tiver user (pra não depender do Auth component)
      // (e não enviar AUTH repetido)
      if (!didAuthWsRef.current) {
        u.getIdToken()
          .then((token) => {
            sendWS({ type: "AUTH", token, userId: u.uid });
            sendWS({ type: "SET_USER", username: u.displayName || "Duelista", userId: u.uid });
            didAuthWsRef.current = true;
          })
          .catch(() => {});
      } else {
        sendWS({ type: "SET_USER", username: u.displayName || "Duelista", userId: u.uid });
      }
    });

    return () => unsub();
  }, []);

  // ✅ WS conecta 1 vez e escuta eventos
  useEffect(() => {
    connectWS((raw: any) => {
      const msg = safeJson(raw) as ServerMsg | null;

      console.log("📩 WS RAW:", raw);
      console.log("📩 WS PARSED:", msg);

      if (!msg || !msg.type) return;

      if (msg.type === "VIEW") {
  // ✅ pega a view como string (server pode mandar qualquer coisa)
  const rawView = String(msg.view || "lobby");

  // ✅ converte só se estiver na whitelist
  const allowedViews: View[] = ["auth", "lobby", "searching", "found", "error", "duel"];
  const v: View | null = allowedViews.includes(rawView as View) ? (rawView as View) : null;

  // se veio coisa estranha do servidor, ignora
  if (!v) return;

  // ✅ não deixa o server tirar a tela FOUND imediatamente
  if (v === "duel") {
    const now = Date.now();
    if (now < blockDuelViewUntilRef.current) {
      console.log("⛔ Ignorando VIEW=duel (bloqueado temporariamente)");
      return;
    }
  }

  // só troca pra lobby/searching/error/found/auth (duel a UI não usa)
  if (v === "lobby" || v === "searching" || v === "error" || v === "found" || v === "auth") {
    setView(v);
  }

  return;
}


      if (msg.type === "ERROR") {
        setErr(msg.message || "Erro desconhecido.");
        setView("error");
        return;
      }

      if (msg.type === "MATCH_CANCELLED") {
        setErr("O oponente saiu. Tente novamente.");
        setMatch(null);
        localStorage.removeItem(LS_ACTIVE_MATCH);
        setView("lobby");
        return;
      }

      if (msg.type === "USER") {
        if (msg.username) setUsername(msg.username);
        return;
      }

      if (msg.type === "MATCH_FOUND") {
        const myUserId = msg.you?.userId || auth.currentUser?.uid || "";

        // salva pra reabrir depois
        localStorage.setItem(LS_ACTIVE_MATCH, msg.matchId);

        setMatch({
          matchId: msg.matchId,
          host: "",
          port: 0,
          roomId: msg.roomId,
          opponentName: msg.opponent?.username,
          api: msg.api,
          joinKey: msg.joinKey,
          myUserId
        });

        // bloqueia VIEW=duel por 6s para a UI "FOUND" aparecer
        blockDuelViewUntilRef.current = Date.now() + 6000;

        setView("found");
        return;
      }

      // ✅ resposta do rejoin (joinKey nova)
      if (msg.type === "JOIN_KEY") {
        const myUserId = msg.you?.userId || auth.currentUser?.uid || "";

        setMatch((prev) => ({
          matchId: msg.matchId,
          host: prev?.host || "",
          port: prev?.port || 0,
          pass: prev?.pass,
          roomId: prev?.roomId || "random_free",
          opponentName: prev?.opponentName,
          api: msg.api,
          joinKey: msg.joinKey,
          myUserId
        }));

        blockDuelViewUntilRef.current = Date.now() + 6000;
        setView("found");
        return;
      }
    });
  }, []);

  // ✅ Auth component callback (mantido)
  const onLoginSuccess = async (name: string) => {
    setUsername(name);
    setErr(null);

    const u = auth.currentUser;
    if (!u) {
      setErr("Usuário não encontrado no Firebase (auth.currentUser).");
      setView("error");
      return;
    }

    try {
      const token = await u.getIdToken();

      if (!didAuthWsRef.current) {
        sendWS({ type: "AUTH", token, userId: u.uid });
        didAuthWsRef.current = true;
      }

      sendWS({ type: "SET_USER", username: name, userId: u.uid });

      setView("lobby");
    } catch (e: any) {
      setErr("Falha ao pegar token do Firebase: " + (e?.message || "erro"));
      setView("error");
    }
  };

  const findMatch = () => {
    setErr(null);
    setMatch(null);
    setView("searching");

    sendWS({
      type: "FIND_MATCH",
      roomId
    });
  };

  const cancelSearch = () => {
    sendWS({ type: "CANCEL_MATCHMAKE" });
    setView("lobby");
  };

  const logout = async () => {
  try {
    // ✅ cancela busca e limpa estado antes
    sendWS({ type: "CANCEL_MATCHMAKE" });

    didAuthWsRef.current = false;
    setMatch(null);
    localStorage.removeItem(LS_ACTIVE_MATCH);
    setErr(null);

    await signOut(auth);

    // ✅ força estado local imediatamente
    setIsLogged(false);
    setView("auth");
  } catch {}
};


  const activeMatchId = localStorage.getItem(LS_ACTIVE_MATCH) || "";

  const requestRejoin = () => {
    if (!activeMatchId) return;
    setErr(null);
    // pede uma joinKey nova pro server
    sendWS({ type: "REQUEST_JOIN_KEY", matchId: activeMatchId });
  };

  const openEngineByClick = () => {
    if (!match?.api || !match.joinKey || !match.myUserId) {
      setErr("Match incompleto para abrir o launcher (api/joinKey/userId).");
      setView("error");
      return;
    }

    launchEdopro({
      api: match.api,
      matchId: match.matchId,
      userId: match.myUserId,
      key: match.joinKey,
      nick: username,
      room: match.matchId
    });
  };

  // ================= UI mínima =================
  // evita piscar login antes do Firebase decidir se está logado
  if (!authReady) {
    return (
      <div className="w-screen h-screen bg-black text-white flex items-center justify-center">
        Carregando...
      </div>
    );
  }

  if (!isLogged || view === "auth") return <Auth onLoginSuccess={onLoginSuccess} />;

  return (
    <div className="w-screen h-screen bg-black text-white flex items-center justify-center p-8">
      <div className="w-full max-w-3xl border border-white/10 rounded-2xl p-8 bg-white/5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-white/40 text-xs uppercase tracking-[0.3em]">Duelista</div>
            <div className="text-2xl font-black">{username}</div>
          </div>

          <button
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-xs uppercase tracking-widest"
            onClick={logout}
          >
            Sair
          </button>
        </div>

        {/* ✅ Rejoin */}
        {activeMatchId && view !== "searching" && (
          <div className="mt-6 p-4 rounded-xl border border-white/10 bg-white/5 flex items-center justify-between gap-3">
            <div className="text-xs text-white/70">
              Você tem um duelo ativo salvo: <b>{activeMatchId.slice(0, 8)}...</b>
            </div>
            <button
              onClick={requestRejoin}
              className="px-4 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-xs font-black uppercase tracking-widest"
            >
              Voltar ao duelo
            </button>
          </div>
        )}

        <div className="mt-8">
          <div className="text-white/40 text-xs uppercase tracking-[0.3em] mb-3">Salas</div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {ROOMS.map((r) => (
              <button
                key={r.id}
                onClick={() => setRoomId(r.id)}
                disabled={view === "searching"}
                className={`text-left p-4 rounded-xl border transition-all disabled:opacity-50 ${
                  roomId === r.id
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-white/10 bg-white/5 hover:bg-white/8"
                }`}
              >
                <div className="font-black">{r.title}</div>
                <div className="text-xs text-white/40 mt-1">{r.subtitle}</div>
              </button>
            ))}
          </div>

          <div className="mt-6 flex items-center justify-between gap-4">
            <div className="text-xs text-white/40">
              Sala selecionada:{" "}
              <span className="text-white/80 font-bold">{selectedRoom.title}</span>
            </div>

            {view === "lobby" && (
              <button
                onClick={findMatch}
                className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-black uppercase tracking-widest text-xs"
              >
                Achar Duelo
              </button>
            )}
          </div>

          {view === "searching" && (
            <div className="mt-6 p-5 rounded-xl border border-white/10 bg-black/40 flex items-center justify-between">
              <div>
                <div className="font-black">Procurando oponente...</div>
                <div className="text-xs text-white/40 mt-1">
                  Entrando na fila da sala e aguardando adversário.
                </div>
              </div>
              <button
                onClick={cancelSearch}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-xs uppercase tracking-widest"
              >
                Cancelar
              </button>
            </div>
          )}

          {view === "found" && match && (
            <div className="mt-6 p-5 rounded-xl border border-green-500/30 bg-green-500/10">
              <div className="font-black text-green-300">Duelo encontrado!</div>

              <div className="text-xs text-white/60 mt-2">
                Match: <b>{match.matchId}</b> • Sala: <b>{match.roomId}</b>
                {match.opponentName ? (
                  <>
                    {" "}
                    • Oponente: <b>{match.opponentName}</b>
                  </>
                ) : null}
              </div>

              {/* Mantido */}
              <div className="text-xs text-white/60 mt-1">
                Host: <b>{match.host}:{match.port}</b>
              </div>

              {/* KEY flow */}
              <div className="text-xs text-white/60 mt-1">
                API: <b>{match.api || "-"}</b> • Key:{" "}
                <b>{match.joinKey ? match.joinKey.slice(0, 6) + "..." : "-"}</b>
              </div>

              <div className="mt-4 text-xs text-white/40">
                ⚠️ O navegador bloqueia abrir protocolo automaticamente. Clique no botão para abrir o launcher.
              </div>

              <div className="mt-4 flex gap-3">
                <button
                  onClick={openEngineByClick}
                  className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:hover:bg-green-600 text-xs font-black uppercase tracking-widest"
                  disabled={!match.api || !match.joinKey || !match.myUserId}
                >
                  Abrir Engine
                </button>

                {/* Botão antigo mantido (não deletado) */}
                <button
                  disabled={!canLaunch(match.host, match.port)}
                  onClick={() => {
                    // mantido por compat (não recomendado no KEY flow)
                    // @ts-ignore
                    launchEdopro({ host: match.host, port: match.port, pass: match.pass });
                  }}
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-50 text-xs uppercase tracking-widest"
                  title="Modo antigo (host/port) — mantido apenas por compatibilidade"
                >
                  Abrir Engine (antigo)
                </button>

                <button
                  onClick={() => {
                    setMatch(null);
                    setView("lobby");
                  }}
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-xs uppercase tracking-widest"
                >
                  Voltar
                </button>
              </div>
            </div>
          )}

          {view === "error" && (
            <div className="mt-6 p-5 rounded-xl border border-red-500/30 bg-red-500/10">
              <div className="font-black text-red-300">Erro</div>
              <div className="text-xs text-white/70 mt-2">{err || "Ocorreu um erro."}</div>
              <div className="mt-4">
                <button
                  onClick={() => setView("lobby")}
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-xs uppercase tracking-widest"
                >
                  Voltar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
