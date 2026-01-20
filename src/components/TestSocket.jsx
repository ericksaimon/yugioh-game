import { useEffect } from "react";
import { auth } from "../firebase"; // ajuste o caminho

export default function TestSocket() {

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:3001");

    ws.onopen = async () => {
      console.log("WS conectado");

      const user = auth.currentUser;
      if (!user) {
        console.log("Usuário não está logado");
        return;
      }

      const token = await user.getIdToken();

      ws.send(JSON.stringify({
        type: "AUTH",
        token
      }));
    };

    ws.onmessage = (ev) => {
      console.log("Servidor respondeu:", ev.data);
    };

    return () => ws.close();
  }, []);

  return (
    <div>
      Testando conexão com servidor...
    </div>
  );
}
