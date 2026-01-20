import React, { useEffect, useMemo, useRef, useState } from "react";
import Auth from "./components/Auth";
import { auth } from "./firebase";
import { connectWS, sendWS } from "./ws";

type View = "auth" | "lobby" | "searching" | "found" | "error";

type RoomId =
  | "random_500"
  | "random_800"
  | "random_1000"
  | "random_1500"
  | "random_free";

type ServerMsg =
  | { type: "AUTH_OK" }
  | { type: "AUTH_FAIL"; reason?: string }
  | { type: "VIEW"; view: View }
  | { type: "ERROR"; message: string }
  | {
      type: "MATCH_FOUND";
      matchId: string;
      roomId: RoomId;
      host: string; // ip/dns
      port: number;
      pass?: string;
      you?: { userId: string; username: string };
      opponent?: { userId: string; username: string };
    }
  | { type: "MATCH_CANCELLED"; reason?: string }
  | { type: string; [k: string]: any };

function safeJson(raw: any) {
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function canLaunch(host: string, port: number) {
  if (!host) return false;
  if (host === "AUTO") return false;
  if (!Number.isFinite(port) || port <= 0) return false;
  return true;
}

// ✅ abre o launcher via protocolo (se estiver registrado no Windows)
function launchEdopro(params: { host: string; port: number; pass?: string }) {
  const link = `yugiohcgmd://join?host=${encodeURIComponent(params.host)}&port=${params.port}${
    params.pass ? `&pass=${encodeURIComponent(params.pass)}` : ""
  }`;

  console.log("🔗 LINK LAUNCHER:", link);

  // Tenta abrir (Windows com protocolo registrado)
  window.location.href = link;
}

const ROOMS: { id: RoomId; title: string; subtitle: string }[] = [
  { id: "random_500", title: "Random Duel 500", subtitle: "Deck <= 500 WizardMoney" },
  { id: "random_800", title: "Random Duel 800", subtitle: "Deck <= 800 WizardMoney" },
  { id: "random_1000", title: "Random Duel 1000", subtitle: "Deck <= 1000 WizardMoney" },
  { id: "random_1500", title: "Random Duel 1500", subtitle: "Deck <= 1500 WizardMoney" },
  { id: "random_free", title: "Random Duel Livre", subtitle: "Sem limite (BO1)" }
];

const App: React.FC = () => {
  const [view, setView] = useState<View>("auth");
  const [username, setUsername] = useState<string>("Duelista");
  const [roomId, setRoomId] = useState<RoomId>("random_800");
  const [err, setErr] = useState<string | null>(null);

  const [match, setMatch] = useState<null | {
    matchId: string;
    host: string;
    port: number;
    pass?: string;
    roomId: RoomId;
    opponentName?: string;
  }>(null);

  // flags para não repetir ações
  const didConnectRef = useRef(false);
  const didAuthWsRef = useRef(false);
  const pendingLoginRef = useRef<{ username: string } | null>(null);

  const selectedRoom = useMemo(
    () => ROOMS.find((r) => r.id === roomId)!,
    [roomId]
  );

  // ✅ WS: conecta 1 vez e escuta eventos
  useEffect(() => {
    if (didConnectRef.current) return;
    didConnectRef.current = true;

    connectWS((raw: any) => {
      const msg = safeJson(raw) as ServerMsg | null;
      if (!msg) return;

      console.log("📩 WS:", msg);

      if (msg.type === "VIEW" && msg.view) {
        // não deixa server te jogar pra auth do nada (auth é só local)
        if (msg.view !== "auth") setView(msg.view);
      }

      if (msg.type === "AUTH_OK") {
        // servidor respondeu ok (se você quiser usar isso)
        return;
      }

      if (msg.type === "AUTH_FAIL") {
        setErr(msg.reason || "Falha ao autenticar no servidor.");
        setView("error");
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
        setView("lobby");
        return;
      }

      if (msg.type === "MATCH_FOUND") {
        const m = {
          matchId: msg.matchId,
          host: msg.host,
          port: msg.port,
          pass: msg.pass,
          roomId: msg.roomId,
          opponentName: msg.opponent?.username
        };

        setMatch(m);
        setErr(null);
        setView("found");

        // ✅ Só tenta abrir automaticamente se host/porta forem válidos
        if (canLaunch(m.host, m.port)) {
          launchEdopro({ host: m.host, port: m.port, pass: m.pass });
        } else {
          console.log("ℹ️ Host/porta ainda não configurados para auto-join:", m.host, m.port);
        }
        return;
      }
    });
  }, []);

  // ✅ depois do login (Auth), autentica o WS com token + uid
  const onLoginSuccess = async (name: string) => {
    setUsername(name);
    setErr(null);

    const u = auth.currentUser;
    if (!u) {
      setErr("Usuário não encontrado no Firebase (auth.currentUser).");
      setView("error");
      return;
    }

    pendingLoginRef.current = { username: name };

    try {
      const token = await u.getIdToken();

      // evita mandar AUTH repetido
      if (!didAuthWsRef.current) {
        sendWS({ type: "AUTH", token, userId: u.uid });
        didAuthWsRef.current = true;
      }

      // manda perfil (sempre ok mandar)
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

  // ================= UI mínima =================
  if (view === "auth") return <Auth onLoginSuccess={onLoginSuccess} />;

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
            onClick={() => window.location.reload()}
          >
            Sair
          </button>
        </div>

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

              <div className="text-xs text-white/60 mt-1">
                Host: <b>{match.host}:{match.port}</b>
              </div>

              {!canLaunch(match.host, match.port) && (
                <div className="mt-4 text-xs text-yellow-200/80">
                  ⚠️ Seu servidor ainda não está enviando um <b>host/porta real</b> do duelo.
                  No Railway isso costuma ser “1 porta só”, então o auto-join do EDOPro não funciona ainda.
                </div>
              )}

              <div className="mt-4 text-xs text-white/40">
                Se não abriu automaticamente, seu protocolo <b>yugiohcgmd://</b> não está registrado no Windows.
              </div>

              <div className="mt-4 flex gap-3">
                <button
                  disabled={!canLaunch(match.host, match.port)}
                  onClick={() => launchEdopro({ host: match.host, port: match.port, pass: match.pass })}
                  className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:hover:bg-green-600 text-xs font-black uppercase tracking-widest"
                >
                  Abrir Engine
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
