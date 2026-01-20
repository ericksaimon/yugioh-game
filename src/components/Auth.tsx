import React, { useState } from "react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth } from "../firebase";

export default function Auth({ onLoginSuccess }: { onLoginSuccess: (username: string) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [username, setUsername] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setErr(null);
    setLoading(true);
    try {
      if (mode === "register") {
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        if (username.trim()) {
          await updateProfile(cred.user, { displayName: username.trim() });
        }
        onLoginSuccess(username.trim() || "Duelista");
      } else {
        const cred = await signInWithEmailAndPassword(auth, email, pass);
        onLoginSuccess(cred.user.displayName || "Duelista");
      }
    } catch (e: any) {
      setErr(e?.message || "Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-screen h-screen bg-black text-white flex items-center justify-center p-8">
      <div className="w-full max-w-md p-6 rounded-2xl border border-white/10 bg-white/5">
        <h1 className="text-2xl font-black mb-4">Yu-Gi-Oh! Login</h1>

        <div className="flex gap-2 mb-4">
          <button
            className={`flex-1 p-2 rounded-lg ${mode === "login" ? "bg-blue-600" : "bg-white/10"}`}
            onClick={() => setMode("login")}
          >
            Entrar
          </button>
          <button
            className={`flex-1 p-2 rounded-lg ${mode === "register" ? "bg-blue-600" : "bg-white/10"}`}
            onClick={() => setMode("register")}
          >
            Criar conta
          </button>
        </div>

        {mode === "register" && (
          <input
            className="w-full p-3 rounded-lg bg-black/40 border border-white/10 mb-3"
            placeholder="Nome de usuário"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        )}

        <input
          className="w-full p-3 rounded-lg bg-black/40 border border-white/10 mb-3"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          className="w-full p-3 rounded-lg bg-black/40 border border-white/10 mb-3"
          placeholder="Senha"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
        />

        {err && <div className="text-red-300 text-sm mb-3">{err}</div>}

        <button
          disabled={loading}
          onClick={submit}
          className="w-full p-3 rounded-lg bg-blue-600 hover:bg-blue-500 font-black disabled:opacity-50"
        >
          {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
        </button>
      </div>
    </div>
  );
}
