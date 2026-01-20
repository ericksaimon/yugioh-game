type WSGlobal = Window & { __YGO_WS__?: WebSocket; __YGO_WS_QUEUE__?: string[]; __YGO_WS_LOCK__?: boolean };

const WS_URL =
  (import.meta as any).env?.VITE_WS_URL ||
  "ws://localhost:3001";

export function connectWS(onMessage: (msg: any) => void) {
  const w = window as WSGlobal;

  // já conectado/conectando
  if (w.__YGO_WS__ && (w.__YGO_WS__.readyState === WebSocket.OPEN || w.__YGO_WS__.readyState === WebSocket.CONNECTING)) {
    return;
  }

  if (w.__YGO_WS_LOCK__) return; // evita spam de reconexão em loop
  w.__YGO_WS_LOCK__ = true;

  if (!w.__YGO_WS_QUEUE__) w.__YGO_WS_QUEUE__ = [];

  const socket = new WebSocket(WS_URL);
  w.__YGO_WS__ = socket;

  socket.onopen = () => {
    console.log("✅ WS conectado:", WS_URL);
    w.__YGO_WS_LOCK__ = false;

    // flush fila
    const q = w.__YGO_WS_QUEUE__ || [];
    while (q.length) {
      const payload = q.shift();
      if (!payload) continue;
      try { socket.send(payload); } catch {}
    }
  };

  socket.onmessage = (e) => {
    try {
      onMessage(JSON.parse(e.data));
    } catch {
      onMessage(e.data);
    }
  };

  socket.onclose = () => {
    console.log("❌ WS desconectado");
    if (w.__YGO_WS__ === socket) w.__YGO_WS__ = undefined;

    // tenta reconectar (backoff simples)
    setTimeout(() => {
      w.__YGO_WS_LOCK__ = false;
      connectWS(onMessage);
    }, 1200);
  };

  socket.onerror = (err) => {
    console.log("⚠️ WS erro", err);
    // deixa o onclose cuidar
  };
}

export function sendWS(obj: any) {
  const w = window as WSGlobal;
  const payload = JSON.stringify(obj);

  // se não tem socket ou não tá OPEN, guarda na fila
  if (!w.__YGO_WS__ || w.__YGO_WS__.readyState !== WebSocket.OPEN) {
    if (!w.__YGO_WS_QUEUE__) w.__YGO_WS_QUEUE__ = [];
    w.__YGO_WS_QUEUE__!.push(payload);
    return;
  }

  try {
    w.__YGO_WS__!.send(payload);
  } catch {
    // se falhar, re-enfileira
    if (!w.__YGO_WS_QUEUE__) w.__YGO_WS_QUEUE__ = [];
    w.__YGO_WS_QUEUE__!.push(payload);
  }
}
