// src/ws.ts

type WSHandler = (data: any) => void;

let ws: WebSocket | null = null;
let handler: WSHandler | null = null;

let isConnecting = false;
let reconnectAttempts = 0;
let reconnectTimer: number | null = null;
let heartbeatTimer: number | null = null;
let sendQueue: any[] = [];

const MAX_RECONNECT_DELAY = 10000;

// Resolve URL do WebSocket
function getWsUrl() {
  const envUrl = (import.meta as any).env?.VITE_WS_URL as string | undefined;
  if (envUrl && envUrl.trim()) return envUrl.trim();

  // fallback automático
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}`;
}

export function connectWS(onMessage: WSHandler) {
  handler = onMessage;

  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  if (isConnecting) return;
  isConnecting = true;

  const url = getWsUrl();
  console.log("🔌 Connecting WS:", url);

  ws = new WebSocket(url);

  ws.onopen = () => {
    console.log("✅ WS connected");
    isConnecting = false;
    reconnectAttempts = 0;

    // envia fila pendente
    for (const msg of sendQueue) {
      try {
        ws?.send(JSON.stringify(msg));
      } catch {}
    }
    sendQueue = [];

    // inicia heartbeat (mantém conexão viva em VPS)
    startHeartbeat();
  };

  ws.onmessage = (ev) => {
  if (!handler) return;

  try {
    const data = JSON.parse(ev.data);

    // opcional: ignore PONG/heartbeat
    if (data?.type === "PONG") return;

    handler(data);
  } catch {
    // se vier texto puro, ainda entrega
    handler(ev.data);
  }
};


  ws.onerror = (err) => {
    console.error("❌ WS error", err);
  };

  ws.onclose = () => {
    console.warn("🔌 WS closed");
    isConnecting = false;
    stopHeartbeat();

    // backoff exponencial (até 10s)
    const delay = Math.min(1000 * 2 ** reconnectAttempts, MAX_RECONNECT_DELAY);
    reconnectAttempts++;

    console.log(`🔁 Reconnecting in ${delay}ms...`);

    if (reconnectTimer) window.clearTimeout(reconnectTimer);
    reconnectTimer = window.setTimeout(() => {
      connectWS(onMessage);
    }, delay);
  };
}

// Envia mensagens com segurança
export function sendWS(obj: any) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    sendQueue.push(obj);
    return;
  }

  try {
    ws.send(JSON.stringify(obj));
  } catch (err) {
    console.error("❌ Failed to send WS message:", err);
  }
}

// Heartbeat para manter conexão viva em produção
function startHeartbeat() {
  stopHeartbeat();

  heartbeatTimer = window.setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: "PING" }));
      } catch {}
    }
  }, 25000);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    window.clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}
