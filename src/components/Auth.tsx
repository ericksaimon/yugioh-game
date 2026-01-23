import React, { useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile
} from "firebase/auth";
import { auth } from "../firebase";

export default function Auth({
  onLoginSuccess
}: {
  onLoginSuccess: (username: string) => void;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [username, setUsername] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // ✅ impede “login fantasma”: só chama onLoginSuccess quando REALMENTE logou
  // e garante que em aba anônima não vai entrar sozinho.
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      if (!u) return; // não está logado -> fica na tela
      const name = (u.displayName || "").trim();
      onLoginSuccess(name || "Duelista");
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isValidEmail = useMemo(() => email.trim().includes("@"), [email]);
  const canSubmit = useMemo(() => {
    if (loading) return false;
    if (!email.trim() || !pass.trim()) return false;
    if (!isValidEmail) return false;
    if (pass.trim().length < 6) return false; // regra do Firebase
    if (mode === "register" && !username.trim()) return false;
    return true;
  }, [loading, email, pass, isValidEmail, mode, username]);

  const submit = async () => {
    setErr(null);

    // ✅ validações para não permitir submit com campos vazios
    if (!email.trim() || !pass.trim()) {
      setErr("Preencha email e senha.");
      return;
    }
    if (!isValidEmail) {
      setErr("Email inválido.");
      return;
    }
    if (pass.trim().length < 6) {
      setErr("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (mode === "register" && !username.trim()) {
      setErr("Informe um nome de usuário.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "register") {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass.trim());

        // ✅ define displayName no Firebase
        const name = username.trim();
        await updateProfile(cred.user, { displayName: name });

        // ✅ NÃO chama onLoginSuccess aqui — o onAuthStateChanged vai chamar
        // quando a sessão realmente estiver ativa (evita “entrar sozinho”).
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), pass.trim());
        // ✅ NÃO chama onLoginSuccess aqui — onAuthStateChanged cuida disso.
      }
    } catch (e: any) {
      // mensagens mais amigáveis (sem perder nada do que já existe)
      const code = e?.code as string | undefined;
      if (code === "auth/invalid-credential") setErr("Email ou senha incorretos.");
      else if (code === "auth/email-already-in-use") setErr("Esse email já está em uso.");
      else if (code === "auth/invalid-email") setErr("Email inválido.");
      else if (code === "auth/weak-password") setErr("Senha fraca. Use pelo menos 6 caracteres.");
      else setErr(e?.message || "Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  };

  const onEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") submit();
  };

  return (
    <div className="w-screen h-screen bg-black text-white flex items-center justify-center p-8">
      <div className="w-full max-w-md p-6 rounded-2xl border border-white/10 bg-white/5">
        <h1 className="text-2xl font-black mb-4">Yu-Gi-Oh! Login</h1>

        <div className="flex gap-2 mb-4">
          <button
            className={`flex-1 p-2 rounded-lg ${mode === "login" ? "bg-blue-600" : "bg-white/10"}`}
            onClick={() => {
              setErr(null);
              setMode("login");
            }}
            disabled={loading}
          >
            Entrar
          </button>
          <button
            className={`flex-1 p-2 rounded-lg ${mode === "register" ? "bg-blue-600" : "bg-white/10"}`}
            onClick={() => {
              setErr(null);
              setMode("register");
            }}
            disabled={loading}
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
            onKeyDown={onEnter}
            autoComplete="nickname"
          />
        )}

        <input
          className="w-full p-3 rounded-lg bg-black/40 border border-white/10 mb-3"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={onEnter}
          autoComplete={mode === "login" ? "email" : "email"}
          inputMode="email"
        />

        <input
          type="password"
          className="w-full p-3 rounded-lg bg-black/40 border border-white/10 mb-3"
          placeholder="Senha"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          onKeyDown={onEnter}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />

        {err && <div className="text-red-300 text-sm mb-3">{err}</div>}

        <button
          disabled={!canSubmit}
          onClick={submit}
          className="w-full p-3 rounded-lg bg-blue-600 hover:bg-blue-500 font-black disabled:opacity-50"
        >
          {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
        </button>

        <div className="mt-3 text-xs text-white/40">
          Dica: senha mínima do Firebase é 6 caracteres.
        </div>
      </div>
    </div>
  );
}
