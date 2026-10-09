"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AgentComposer, type ComposerHandle } from "./agent-composer";

type Provider = "openai" | "deepseek" | "gemini" | "claude" | "mistral";
type Mode = Provider | "multi";
type Message = { role: "user" | "assistant"; content: string; meta?: string };
type Run = { id: number; title: string; model: string; status: "running" | "done" | "error"; seconds?: number; note?: string; prUrl?: string; deploymentUrl?: string };
type Health = {
  ok: boolean;
  providers: { configured: Provider[] };
  integrations: { github: boolean; vercel: boolean; supabase: boolean };
  executionEnabled: boolean;
};
type AgentReply = { text?: string; error?: string; provider?: string; contributors?: string[]; action?: string; prUrl?: string; deploymentUrl?: string };

const models: { id: Mode; title: string; subtitle: string; symbol: string; color: string }[] = [
  { id: "multi", title: "Multi AI", subtitle: "Команда моделей", symbol: "✳", color: "berry" },
  { id: "openai", title: "OpenAI", subtitle: "Код та логіка", symbol: "◎", color: "mint" },
  { id: "claude", title: "Claude", subtitle: "Робота з контекстом", symbol: "✻", color: "berry" },
  { id: "gemini", title: "Gemini", subtitle: "Дослідження", symbol: "✦", color: "sky" },
  { id: "deepseek", title: "DeepSeek", subtitle: "Розробка", symbol: "◈", color: "sky" },
  { id: "mistral", title: "Mistral", subtitle: "Тексти та аналіз", symbol: "❖", color: "sun" },
];

const shortcuts = [
  { id: "plan", symbol: "↗", title: "План", caption: "Спланувати проєкт", value: "Склади чіткий покроковий план для мого проєкту ARTSS AI. Виділи пріоритети, ризики та наступні дії." },
  { id: "build", symbol: "⌘", title: "Код", caption: "Зробити покращення", value: "Переглянь код мого застосунку та запропонуй мінімальне безпечне покращення з конкретними змінами і тестами." },
  { id: "audit", symbol: "◉", title: "Аудит", caption: "Перевірити якість", value: "Проведи аудит архітектури ARTSS AI: безпека, надійність, логіка моделей, GitHub, Vercel і Supabase. Не змінюй файли." },
  { id: "release", symbol: "⇧", title: "Реліз", caption: "Оцінити готовність", value: "Перевір готовність ARTSS AI до наступного релізу: тести, блокери, підключення та безпечний план деплою. Не публікуй без перевірок." },
];

const integrations = [
  { key: "github" as const, title: "GitHub", subtitle: "cocosend/artssapp-agent", mark: "GH", href: "https://github.com/cocosend/artssapp-agent" },
  { key: "vercel" as const, title: "Vercel", subtitle: "artssapp-agent", mark: "▲", href: "https://vercel.com/artssby-apps/artssapp-agent" },
  { key: "supabase" as const, title: "Supabase", subtitle: "ARTSSAGENTSSBOT", mark: "S", href: "https://supabase.com/dashboard/project/hyvsmtxewxpfnlzfjvca" },
];

function Icon({ name, size = 18 }: { name: "send" | "arrow" | "plus" | "refresh" | "logout" | "check" | "shield" | "chevron" | "copy"; size?: number }) {
  const paths = {
    send: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    refresh: <><path d="M20 11a8 8 0 0 0-14-5L4 8m0-5v5h5M4 13a8 8 0 0 0 14 5l2-2m0 5v-5h-5" /></>,
    logout: <><path d="m10 17 5-5-5-5m5 5H3m10-9h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    copy: <><rect x="8" y="8" width="13" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function displayTime(ms: number) {
  return new Date(ms).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });
}

export default function Home() {
  const router = useRouter();
  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState("");
  const [loading, setLoading] = useState(true);
  const [lastCheck, setLastCheck] = useState("");
  const [selected, setSelected] = useState<Mode>("multi");
  const [messages, setMessages] = useState<Message[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const composerRef = useRef<ComposerHandle>(null);
  const modelRef = useRef<HTMLDivElement>(null);
  const shortcutRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const inFlightHealth = useRef(false);
  const configured = health?.providers.configured ?? [];
  const ready = selected === "multi" ? configured.length > 0 : configured.includes(selected);

  const refresh = useCallback(async () => {
    if (inFlightHealth.current) return;
    inFlightHealth.current = true;
    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      if (!response.ok) throw new Error("Немає відповіді від сервера.");
      const data: Health = await response.json();
      if (!Array.isArray(data.providers?.configured) || !data.integrations) throw new Error("Невідомий формат стану сервера.");
      setHealth(previous => JSON.stringify(previous) === JSON.stringify(data) ? previous : data);
      setHealthError("");
      setLastCheck(displayTime(Date.now()));
    } catch (error) {
      setHealth(null);
      setHealthError(error instanceof Error ? error.message : "Сервіс недоступний.");
    } finally {
      inFlightHealth.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const immediate = window.setTimeout(() => { void refresh(); }, 0);
    const interval = window.setInterval(() => { if (!document.hidden) void refresh(); }, 90_000);
    return () => { window.clearTimeout(immediate); window.clearInterval(interval); };
  }, [refresh]);

  useEffect(() => {
    if (messages.length) threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "auto" });
  }, [messages]);

  function chooseTask(text: string) {
    composerRef.current?.fill(text);
  }

  async function submit(text: string) {
    const task = text.trim();
    if (!task || busy || (health && !ready)) return;
    const started = performance.now();
    const id = Date.now();
    const conversation: Message[] = [...messages.slice(-18), { role: "user", content: task }];
    setMessages(conversation);
    setRuns(previous => [{ id, title: task, model: selected, status: "running" }, ...previous].slice(0, 40));
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/agent", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: selected, messages: conversation.map(({ role, content }) => ({ role, content })) }),
      });
      const result: AgentReply = await response.json().catch(() => ({}));
      if (response.status === 401) {
        setRuns(previous => previous.map(run => run.id === id ? { ...run, status: "error" } : run));
        router.push("/login");
        return;
      }
      if (!response.ok) throw new Error(result.error || "Запит завершився помилкою.");
      const model = result.provider || selected;
      const description = [model, result.action === "executed" ? "Зміни збережено" : result.action === "preview" ? "Підготовлено зміни" : "Відповідь"].join(" · ");
      setMessages(previous => [...previous.slice(-39), { role: "assistant", content: result.text || "Агент не повернув текст.", meta: description }]);
      setRuns(previous => previous.map(run => run.id === id ? {
        ...run, status: "done", model, seconds: (performance.now() - started) / 1000,
        prUrl: result.prUrl, deploymentUrl: result.deploymentUrl, note: description,
      } : run));
    } catch (error) {
      const description = error instanceof Error ? error.message : "Невідома помилка.";
      setMessages(previous => [...previous.slice(-39), { role: "assistant", content: description, meta: "Помилка" }]);
      setRuns(previous => previous.map(run => run.id === id ? { ...run, status: "error", seconds: (performance.now() - started) / 1000, note: description } : run));
    } finally {
      setBusy(false);
    }
  }

  function move(ref: { current: HTMLDivElement | null }, step: number) {
    ref.current?.scrollBy({ left: step * 260, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  async function logout() {
    try { await fetch("/api/auth/logout", { method: "POST" }); }
    finally { router.push("/login"); router.refresh(); }
  }

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setNotice("Відповідь скопійовано."); }
    catch { setNotice("Копіювання недоступне у цьому браузері."); }
  }

  return <div className="pm-shell">
    <header className="pm-header">
      <Link className="pm-brand" href="/" aria-label="ARTSS AI — головна"><span className="pm-brand-mark">a<span>✦</span></span><span className="pm-brand-label">ARTSS<span className="pm-dot">●</span>AI<small>PRIVATE AGENT STUDIO</small></span></Link>
      <div className="pm-header-right">
        <span className={"pm-live " + (health ? "up" : "")}><i />{loading ? "Перевірка" : health ? "Система працює" : "Немає зв'язку"}</span>
        <button type="button" className="pm-round-icon" onClick={() => { setLoading(true); void refresh(); }} title="Оновити стан" aria-label="Оновити стан"><Icon name="refresh" size={17} /></button>
        <button type="button" className="pm-round-icon" onClick={() => { void logout(); }} title="Вийти" aria-label="Вийти"><Icon name="logout" size={17} /></button>
      </div>
    </header>

    <main className="pm-main">
      <section className="pm-hero">
        <div className="pm-hero-copy">
          <span className="pm-kicker"><span className="pm-kicker-mark">✦</span> НОВИЙ РІВЕНЬ ВАШИХ ІДЕЙ</span>
          <h1>Створюйте більше.<br /><span>Без зайвого.</span></h1>
          <p>Усі ваші AI-інструменти в одному спокійному робочому просторі. Один запит — команда моделей.</p>
          <div className="pm-hero-chips"><span>5 AI провайдерів</span><span>Розумний fallback</span><span>Ваш приватний простір</span></div>
        </div>
        <div className="pm-hero-art" aria-hidden="true"><div className="pm-halo pm-halo-one"/><div className="pm-halo pm-halo-two"/><div className="pm-floating pm-floating-a">✳</div><div className="pm-floating pm-floating-b">✦</div><div className="pm-core">✺</div></div>
      </section>

      <div className="pm-layout">
        <div className="pm-primary">
          <section className="pm-panel pm-studio" aria-labelledby="studio-title">
            <div className="pm-section-heading"><div><span className="pm-overline">01 / WORKSPACE</span><h2 id="studio-title">Ваш AI-агент</h2></div><button type="button" className="pm-minor-button" disabled={busy || !messages.length} onClick={() => { setMessages([]); setNotice("Нова розмова відкрита."); }}><Icon name="plus" size={16}/> Нова розмова</button></div>
            {messages.length ? <div className="pm-thread" ref={threadRef} role="log" aria-live="polite">{messages.map((message, index) => <article className={"pm-message " + message.role} key={index}><span className="pm-message-label">{message.role === "user" ? "ВИ" : "ARTSS AI"} <small>{message.meta || ""}</small></span><div className="pm-bubble">{message.content}</div>{message.role === "assistant" ? <button type="button" className="pm-copy" onClick={() => { void copy(message.content); }}><Icon name="copy" size={13}/> Копіювати</button> : null}</article>)}</div> : <div className="pm-empty-chat"><span className="pm-small-orb">✳</span><strong>Що зробимо сьогодні?</strong><p>Пишіть як звичайно. Моделі працюватимуть через налаштовані серверні інтеграції.</p></div>}
            {busy ? <p className="pm-thinking" role="status"><span className="pm-pulse"/>Агент працює над завданням…</p> : null}
            <AgentComposer ref={composerRef} model={models.find(x => x.id === selected)?.title || selected} busy={busy} unavailable={health !== null && !ready} onSend={submit} />
            {healthError ? <div className="pm-notice-error" role="alert">{healthError} <button type="button" onClick={() => { void refresh(); }}>Повторити</button></div> : null}
            {!loading && health && !configured.length ? <div className="pm-notice-error">Потрібен серверний ключ хоча б одного AI-провайдера.</div> : null}
            {!loading && health && !ready ? <div className="pm-notice-error">У вибраної моделі немає налаштованого ключа. Виберіть іншу модель.</div> : null}
          </section>

          <section className="pm-panel pm-shortcuts" aria-labelledby="tasks-title">
            <div className="pm-section-heading"><div><span className="pm-overline">02 / QUICK START</span><h2 id="tasks-title">Швидкий старт</h2></div><div className="pm-arrows"><button type="button" aria-label="Попередні сценарії" onClick={() => move(shortcutRef, -1)}>‹</button><button type="button" aria-label="Наступні сценарії" onClick={() => move(shortcutRef, 1)}>›</button></div></div>
            <div className="pm-carousel pm-actions" ref={shortcutRef}>{shortcuts.map(x => <button type="button" className={"pm-action pm-action-"+x.id} key={x.id} onClick={() => chooseTask(x.value)}><span className="pm-action-mark">{x.symbol}</span><strong>{x.title}</strong><small>{x.caption}</small><span className="pm-action-go"><Icon name="arrow" size={16}/></span></button>)}</div>
          </section>
        </div>

        <aside className="pm-secondary">
          <section className="pm-panel pm-models" aria-labelledby="models-title">
            <div className="pm-section-heading"><div><span className="pm-overline">03 / INTELLIGENCE</span><h2 id="models-title">AI-моделі</h2></div><div className="pm-arrows"><button type="button" aria-label="Попередні моделі" onClick={() => move(modelRef,-1)}>‹</button><button type="button" aria-label="Наступні моделі" onClick={() => move(modelRef,1)}>›</button></div></div>
            <div className="pm-carousel pm-model-carousel" ref={modelRef}>{models.map(m => {
              const active = m.id === "multi" ? configured.length > 0 : configured.includes(m.id);
              return <button type="button" key={m.id} disabled={busy} aria-pressed={selected === m.id} className={"pm-model pm-model-"+m.color + (selected === m.id ? " chosen" : "")} onClick={() => setSelected(m.id)}>
                <span className="pm-model-top"><span className="pm-model-symbol">{m.symbol}</span><span className="pm-model-radio">{selected === m.id ? "✓" : ""}</span></span>
                <strong>{m.title}</strong><small>{m.subtitle}</small>
                <span className={"pm-model-state " + (active ? "active" : "")}><i/>{loading ? "Перевірка" : active ? "Ключ налаштовано" : "Потрібен ключ"}</span>
              </button>;
            })}</div>
            <p className="pm-fine">У Multi AI беруть участь лише налаштовані моделі. Наявність ключа не гарантує доступність API.</p>
          </section>

          <section className="pm-panel pm-stacks" aria-labelledby="system-title">
            <div className="pm-section-heading"><div><span className="pm-overline">04 / SYSTEM</span><h2 id="system-title">Все під контролем</h2></div></div>
            <details className="pm-stack" open><summary><span className="pm-stack-icon">↗</span><span><strong>Підключення</strong><small>GitHub, Vercel, Supabase</small></span><span className="pm-stack-chevron"><Icon name="chevron" size={18}/></span></summary><div className="pm-stack-body">{integrations.map(s => <a key={s.key} className="pm-service" href={s.href} target="_blank" rel="noreferrer"><span className="pm-service-mark">{s.mark}</span><span><strong>{s.title}</strong><small>{s.subtitle}</small></span><span className={"pm-service-state " + (health?.integrations[s.key] ? "configured" : "")}>{health?.integrations[s.key] ? "Налаштовано" : "Не налаштовано"}</span></a>)}</div></details>
            <details className="pm-stack"><summary><span className="pm-stack-icon berry">◷</span><span><strong>Останні запуски</strong><small>{runs.length ? runs.length+" завдань у сесії" : "Поки немає запусків"}</small></span><span className="pm-stack-chevron"><Icon name="chevron" size={18}/></span></summary><div className="pm-stack-body">{runs.length ? runs.map(r => <div className="pm-run" key={r.id}><div><strong>{r.title}</strong><small>{displayTime(r.id)} · {r.model} · {r.seconds ? r.seconds.toFixed(1)+" c" : "обробка"}</small>{r.prUrl?.startsWith("https://github.com/") ? <a href={r.prUrl} rel="noreferrer" target="_blank">Переглянути PR ↗</a> : null}</div><span className={"pm-run-status "+r.status}>{r.status === "done" ? "Готово" : r.status === "error" ? "Помилка" : "Працює"}</span></div>) : <p className="pm-stack-empty">Історія з&apos;явиться після першого запиту. Дані поточної вкладки не зберігаються після оновлення.</p>}</div></details>
            <details className="pm-stack"><summary><span className="pm-stack-icon sun">⚙</span><span><strong>Режим виконання</strong><small>{health?.executionEnabled ? "Дозволено зміни" : "Безпечний перегляд"}</small></span><span className="pm-stack-chevron"><Icon name="chevron" size={18}/></span></summary><div className="pm-stack-body"><p className="pm-fine">Зараз: <strong>{health?.executionEnabled ? "Execution" : "Preview"}</strong>. Режим встановлюється сервером; цей екран не зберігає й не показує секрети.</p><button type="button" className="pm-refresh" onClick={() => { setLoading(true); void refresh(); }}><Icon name="refresh" size={15}/> Оновити стан</button></div></details>
            <div className="pm-sync"><span className={"pm-sync-dot"+(health ? " online":"")}/>{loading ? "Перевірка…" : lastCheck ? "Перевірено "+lastCheck : "Стан невідомий"}</div>
          </section>
        </aside>
      </div>

      {notice ? <div className="pm-toast" role="status"><Icon name="check" size={16}/><span>{notice}</span><button type="button" onClick={() => setNotice("")} aria-label="Закрити">×</button></div> : null}
      <footer className="pm-footer"><span>ARTSS AI <span className="pm-dot">●</span> PRIVATE STUDIO</span><span>Плавно. Розумно. Без зайвого.</span></footer>
    </main>
  </div>;
}
