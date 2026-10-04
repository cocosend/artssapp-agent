"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Не вдалося увійти");
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не вдалося увійти");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-shell">
      <div className="login-card">
        <div className="brand">ARTSS<span>•</span>AI</div>
        <p>Ваш приватний простір AI</p>
        <form onSubmit={submit}>
          <input
            aria-label="Пароль доступу"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Пароль доступу"
            autoComplete="current-password"
          />
          <button disabled={busy || !password}>{busy ? "Перевіряємо…" : "Увійти"}</button>
        </form>
        {error ? <div className="login-error">{error}</div> : null}
      </div>
    </main>
  );
}
