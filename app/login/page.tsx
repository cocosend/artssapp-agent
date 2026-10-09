"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArtssMark } from "../artss-mark";

export default function LoginPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/auth/session", { cache: "no-store", signal: controller.signal })
      .then(response => { if (response.ok && !controller.signal.aborted) router.replace("/"); })
      .catch(() => { /* Offline / unexpected response: login form remains usable. */ })
      .finally(() => { if (!controller.signal.aborted) setCheckingSession(false); });
    return () => controller.abort();
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = code.trim();
    if (busy || !trimmed || trimmed.length > 128) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: trimmed }), cache: "no-store",
      });
      if (!response.ok) {
        if (response.status === 401) throw new Error("Код не підійшов. Перевірте введення та спробуйте ще раз.");
        if (response.status === 429) throw new Error("Забагато спроб. Спробуйте трохи пізніше.");
        throw new Error("Сервер входу тимчасово недоступний. Спробуйте повторити.");
      }
      setCode("");
      router.replace("/");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Помилка входу.");
    } finally { setBusy(false); }
  }

  return <main className="pm-login studio-login">
    <div className="login-glow" aria-hidden="true"/>
    <section className="pm-login-card studio-login-card" aria-labelledby="login-heading">
      <div className="studio-login-top"><div className="pm-login-icon flagship-login-mark" aria-hidden="true"><ArtssMark size={55}/></div>
        <span className="login-private-badge">✦ PRIVATE AGENT STUDIO</span></div>
      <span className="login-eyebrow">ARTSS AI · ДОСТУП</span>
      <h1 id="login-heading">З поверненням <span>додому.</span></h1>
      <p>Увійдіть до вашої приватної студії: AI-моделі, зображення, код і підключення з одного екрана.</p>
      <form onSubmit={submit} aria-label="Вхід до ARTSS AI">
        <label htmlFor="pm-code">Персональний код доступу</label>
        <div className="login-input-wrap">
          <input id="pm-code" type={showCode ? "text" : "password"} inputMode="numeric" autoComplete="current-password"
            spellCheck={false} autoCapitalize="off" maxLength={128} placeholder="Введіть код доступу" value={code}
            onChange={e => { setCode(e.target.value); if (error) setError(""); }}
            disabled={busy} enterKeyHint="go" aria-invalid={Boolean(error)} aria-describedby={error ? "login-error" : undefined} required/>
          <button type="button" className="login-reveal" onClick={() => setShowCode(v => !v)}
            aria-label={showCode ? "Приховати код" : "Показати код"} aria-pressed={showCode} disabled={busy}>
            {showCode ? "Приховати" : "Показати"}
          </button>
        </div>
        {error ? <div id="login-error" className="pm-login-error" role="alert">{error}</div> : null}
        <button type="submit" className="pm-login-submit" disabled={busy || !code.trim()}>
          {busy ? "Перевіряємо доступ…" : "Відкрити студію"} <span aria-hidden="true">↗</span>
        </button>
      </form>
      <div className="login-meta"><span>◈ Захищена сесія</span><span>{checkingSession ? "Перевірка входу…" : "Готово до входу"}</span></div>
      <p className="login-footnote">Ваш код перевіряється сервером. Він не зберігається у налаштуваннях пристрою цим застосунком.</p>
    </section>
  </main>;
}
