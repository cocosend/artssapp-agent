"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !password.trim()) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        const result: { error?: string } = await response.json().catch(() => ({}));
        if (response.status === 401) throw new Error("Невірний код доступу. Перевірте код та повторіть спробу.");
        throw new Error(result.error || "Помилка входу. Спробуйте ще раз.");
      }
      router.replace("/");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не вдалося увійти.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="login-shell">
    <section className="login-showcase">
      <div className="login-brand"><span><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 2 2.1 6 6 2.1-6 2.1-2.1 6-2.1-6-6-2.1 6-2.1 2.1-6Z" /></svg></span><div><strong>ARTSS <em>/ AI</em></strong><small>AGENT CONTROL CENTER</small></div></div>
      <div className="login-showcase-content"><span>PRIVATE INTELLIGENCE SYSTEM / V2.0</span><h1>Ваші ідеї.<br /><span>Ваш AI-агент.</span></h1><p>Розробка, автоматизація та мультимодельний інтелект в одному особистому робочому просторі.</p><div className="login-tags"><span>OPENAI</span><span>DEEPSEEK</span><span>GEMINI</span><span>GITHUB + VERCEL + SUPABASE</span></div></div>
      <div className="login-showcase-footer">© 2026 ARTSS · PRIVATE WORKSPACE</div>
    </section>
    <section className="login-form-panel">
      <div className="login-content">
        <div className="login-top-icon"><svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg></div>
        <div className="login-overline">SECURE ACCESS / 01</div>
        <h2>Поверніться до роботи.</h2>
        <p className="login-lead">Введіть персональний код, щоб відкрити приватну панель ARTSS AI.</p>
        <form className="login-form" onSubmit={submit}>
          <label htmlFor="agent-access">Код доступу</label>
          <div className="login-field">
            <input id="agent-access" aria-label="Код доступу" autoComplete="current-password" inputMode="numeric" type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Введіть ваш код" disabled={busy} required />
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
          </div>
          <button className="login-submit" type="submit" disabled={busy || !password.trim()}>{busy ? "Перевіряємо…" : "Увійти в ARTSS"} <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg></button>
        </form>
        {error ? <div className="login-error" role="alert">{error}</div> : null}
        <div className="login-safe"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /></svg> Приватний доступ · Захищена сесія</div>
        <p className="login-copyright">ARTSS AGENT · PRODUCTION WORKSPACE</p>
      </div>
    </section>
  </main>;
}
