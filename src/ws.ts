type WSGlobal = Window & {
  __YGO_WS__?: WebSocket;
  __YGO_WS_CONNECTING__?: boolean;
  __YGO_WS_QUEUE__?: string[];
};

const getWsUrl = () => {
  // Use no .env:
  // VITE_WS_URL=ws://localhost:3001
  // ou
  // VITE_WS_URL=wss://SEU-PROJETO.up.railway.app
  const url = import.meta.env.VITE_WS_URL as string | undefined;
  return (url && url.trim()) ? url.trim() : "ws://localhost:3001";
};

export function connectWS(onMessage: (msg: any) => void) {
  const w = window as WSGlobal;

  // se já existe socket vivo, não cria outro
  if (
    w.__YGO_WS__ &&
    (w.__YGO_WS__.readyState === WebSocket.OPEN ||
      w.__YGO_WS__.readyState === WebSocket.CONNECTING)
  ) {
    return;
  }

  if (w.__YGO_WS_CONNECTING__) return;
  w.__YGO_WS_CONNECTING__ = true;

  const url = getWsUrl();
  const socket = new WebSocket(url);

  w.__YGO_WS__ = socket;
  w.__YGO_WS_QUEUE__ = w.__YGO_WS_QUEUE__ || [];

  socket.onopen = () => {
    console.log("✅ WS conectado:", url);
    w.__YGO_WS_CONNECTING__ = false;

    // flush fila
    const q = w.__YGO_WS_QUEUE__ || [];
    while (q.length > 0) {
      const payload = q.shift();
      if (payload && socket.readyState === WebSocket.OPEN) socket.send(payload);
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
    w.__YGO_WS_CONNECTING__ = false;

    // reconecta em 1.5s
    setTimeout(() => connectWS(onMessage), 1500);
  };

  socket.onerror = (err) => {
    console.log("⚠️ WS erro", err);
  };
}

export function sendWS(obj: any) {
  const w = window as WSGlobal;
  const payload = JSON.stringify(obj);

  // se não tem socket, cria um buffer e tenta conectar
  if (!w.__YGO_WS__ || w.__YGO_WS__.readyState !== WebSocket.OPEN) {
    w.__YGO_WS_QUEUE__ = w.__YGO_WS_QUEUE__ || [];
    w.__YGO_WS_QUEUE__!.push(payload);
    return;
  }

  w.__YGO_WS__.send(payload);
}
