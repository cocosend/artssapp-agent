"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArtssMark } from "../artss-mark";

export default function LoginPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !code.trim()) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: code }),
      });
      if (!response.ok) {
        if (response.status === 401) throw new Error("Невірний код доступу.");
        throw new Error("Неможливо виконати вхід. Спробуйте пізніше.");
      }
      router.replace("/");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Помилка входу");
    } finally {
      setBusy(false);
    }
  }

  return <main className="pm-login"><section className="pm-login-card">
    <div className="pm-login-icon flagship-login-mark" aria-hidden="true"><ArtssMark size={55}/></div>
    <h1>ARTSS <span>AI.</span></h1>
    <p>Ваш приватний AI-простір. Введіть персональний код, щоб продовжити роботу.</p>
    <form onSubmit={submit}>
      <label htmlFor="pm-code">Код доступу</label>
      <input id="pm-code" type="password" inputMode="numeric" autoComplete="current-password" placeholder="Ваш персональний код" value={code} onChange={event => setCode(event.target.value)} disabled={busy} required />
      <button type="submit" className="pm-login-submit" disabled={busy || !code.trim()}>{busy ? "Перевіряємо…" : "Увійти →"}</button>
    </form>
    {error ? <div className="pm-login-error" role="alert">{error}</div> : null}
    <div className="pm-login-help"><span aria-hidden="true">◇</span> Безпечна приватна сесія · ARTSS AI</div>
  </section></main>;
}
