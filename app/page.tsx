"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Provider = "openai" | "deepseek" | "gemini";
type Mode = Provider | "multi";
type View = "workspace" | "activity" | "connections";
type Message = { role: "user" | "assistant"; content: string; meta?: string; timestamp: number };
type Run = { id: number; task: string; provider: string; status: "running" | "done" | "error"; duration?: number; action?: string; prUrl?: string; deploymentUrl?: string };
type Health = { ok: boolean; timestamp?: string; providers: { configured: Provider[] }; integrations: { github: boolean; vercel: boolean; supabase: boolean }; executionEnabled: boolean };
type IconName = "spark" | "grid" | "activity" | "plug" | "arrow" | "send" | "plus" | "refresh" | "menu" | "close" | "check" | "shield" | "external" | "copy" | "bolt" | "clock" | "chevron" | "logout" | "terminal" | "arrowup" | "circle" | "layers";

function Icon({ name, size = 20, strokeWidth = 1.8 }: { name: IconName; size?: number; strokeWidth?: number }) {
  const paths: Record<IconName, ReactNode> = {
    spark: <><path d="m12 2 1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9L12 2Z" /><path d="m19 17 .75 2.25L22 20l-2.25.75L19 23l-.75-2.25L16 20l2.25-.75L19 17ZM4 17l.6 1.4L6 19l-1.4.6L4 21l-.6-1.4L2 19l1.4-.6L4 17Z" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    activity: <><path d="M3 12h4l3-7 4 14 3-7h4" /></>,
    plug: <><path d="M12 22v-5M9 2v5m6-5v5M7 7h10v4a5 5 0 0 1-10 0V7Z" /></>,
    arrow: <><path d="M5 12h14m-6-6 6 6-6 6" /></>,
    arrowup: <><path d="M12 19V5m-6 6 6-6 6 6" /></>,
    send: <><path d="m22 2-7 20-4-9-9-4 20-7ZM11 13l11-11" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    refresh: <><path d="M20 11a8 8 0 0 0-14-5L4 8m0-5v5h5M4 13a8 8 0 0 0 14 5l2-2m0 5v-5h-5" /></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
    close: <><path d="M5 5 19 19M19 5 5 19" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>,
    external: <><path d="M13 4h7v7M20 4l-9 9" /><path d="M20 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h6" /></>,
    copy: <><rect x="8" y="8" width="13" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>,
    bolt: <><path d="m13 2-9 12h7l-1 8 10-12h-7l0-8Z" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l4 2" /></>,
    chevron: <><path d="m9 18 6-6-6-6" /></>,
    logout: <><path d="M10 17l5-5-5-5m5 5H3m10-9h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5" /></>,
    terminal: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m7 9 3 3-3 3m6 0h4" /></>,
    circle: <><circle cx="12" cy="12" r="9" /></>,
    layers: <><path d="m12 3 9 5-9 5-9-5 9-5Zm-9 10 9 5 9-5M3 18l9 5 9-5" /></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

const modelCards: { id: Mode; name: string; caption: string; icon: string }[] = [
  { id: "multi", name: "Multi AI", caption: "Об'єднаний режим", icon: "✳" },
  { id: "openai", name: "OpenAI", caption: "Архітектура і код", icon: "◈" },
  { id: "deepseek", name: "DeepSeek", caption: "Розробка і аналіз", icon: "◉" },
  { id: "gemini", name: "Gemini", caption: "Контекст і пошук", icon: "✦" },
];

const templates = [
  { number: "01", category: "REVIEW", title: "Аудит репозиторію", text: "Проаналізуй поточний репозиторій: архітектура, ризики, дублювання, технічний борг. Не змінюй файлів." },
  { number: "02", category: "DEBUG", title: "Знайти та виправити баг", text: "Знайди критичну помилку в основному застосунку, поясни причину та підготуй мінімальне безпечне виправлення з тестами." },
  { number: "03", category: "DELIVERY", title: "Підготувати pull request", text: "Перевір поточний стан проєкту й підготуй покращення у новій гілці з pull request. Не деплой у production без перевірок." },
  { number: "04", category: "DEVOPS", title: "Перевірити інфраструктуру", text: "Зроби аудит інтеграцій GitHub, Vercel, Supabase та доступів. Звітуй про конкретні проблеми, нічого не видаляй." },
];

const services = [
  { id: "github" as const, name: "GitHub", monogram: "GH", info: "Репозиторій, гілки, pull requests", href: "https://github.com/cocosend/artssapp-agent" },
  { id: "vercel" as const, name: "Vercel", monogram: "▲", info: "Production, preview, CI/CD", href: "https://vercel.com/artssby-apps/artssapp-agent" },
  { id: "supabase" as const, name: "Supabase", monogram: "S", info: "Дані, пам'ять і Edge Functions", href: "https://supabase.com/dashboard/project/hyvsmtxewxpfnlzfjvca" },
];

function compactTime(ms: number) {
  return new Date(ms).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });
}

export default function Home() {
  const router = useRouter();
  const [view, setView] = useState<View>("workspace");
  const [menuOpen, setMenuOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("multi");
  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState("");
  const [loadingHealth, setLoadingHealth] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [lastSync, setLastSync] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      if (!response.ok) throw new Error("Статус API тимчасово недоступний");
      const data = await response.json() as Health;
      if (!Array.isArray(data.providers?.configured) || !data.integrations) throw new Error("Некоректна відповідь сервера");
      setHealth(data);
      setHealthError("");
      setLastSync(compactTime(Date.now()));
    } catch (error) {
      setHealth(null);
      setHealthError(error instanceof Error ? error.message : "Помилка перевірки");
    } finally {
      setLoadingHealth(false);
    }
  }, []);

  useEffect(() => {
    const immediate = window.setTimeout(() => { void refresh(); }, 0);
    const timer = window.setInterval(() => { void refresh(); }, 60_000);
    return () => { window.clearTimeout(immediate); window.clearInterval(timer); };
  }, [refresh]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const available = health?.providers.configured ?? [];
  const selectedReady = mode === "multi" ? available.length > 0 : available.includes(mode);
  const readyCount = services.filter(s => health?.integrations[s.id]).length;

  function go(next: View) {
    setView(next);
    setMenuOpen(false);
    setNotice("");
  }

  function choose(text: string) {
    setView("workspace");
    setInput(text);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const task = input.trim();
    if (!task || busy || (health !== null && !selectedReady)) return;
    const id = Date.now();
    const started = performance.now();
    const next: Message[] = [...messages, { role: "user", content: task, timestamp: id }];
    setMessages(next);
    setInput("");
    setBusy(true);
    setNotice("");
    setRuns(current => [{ id, task, provider: mode, status: "running" }, ...current]);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: mode, messages: next.map(message => ({ role: message.role, content: message.content })) }),
      });
      const result: { text?: string; provider?: string; action?: string; error?: string; prUrl?: string; deploymentUrl?: string; contributors?: string[] } = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setRuns(current => current.map(run => run.id === id ? { ...run, status: "error" } : run));
        router.push("/login");
        return;
      }
      if (!res.ok) throw new Error(result.error || "Не вдалося виконати запит.");
      const active = result.provider || mode;
      const kind = result.action === "executed" ? "Зміни збережені" : result.action === "preview" ? "Прев'ю змін" : "Відповідь";
      setMessages(current => [...current, { role: "assistant", content: result.text || "Агент не повернув текст відповіді.", meta: active + " · " + kind, timestamp: Date.now() }]);
      setRuns(current => current.map(run => run.id === id ? {
        ...run, provider: active, status: "done", duration: (performance.now() - started) / 1000,
        action: result.action, prUrl: result.prUrl, deploymentUrl: result.deploymentUrl,
      } : run));
      if (result.prUrl) setNotice("Pull request створено: " + result.prUrl);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Неочікувана помилка.";
      setMessages(current => [...current, { role: "assistant", content: text, meta: "Помилка запиту", timestamp: Date.now() }]);
      setRuns(current => current.map(run => run.id === id ? { ...run, status: "error", duration: (performance.now() - started) / 1000 } : run));
    } finally {
      setBusy(false);
    }
  }

  async function copyMessage(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Відповідь скопійовано");
    } catch {
      setNotice("Копіювання не підтримується цим браузером");
    }
  }

  async function logout() {
    try { await fetch("/api/auth/logout", { method: "POST" }); }
    finally { router.push("/login"); router.refresh(); }
  }

  const nav: { id: View; name: string; icon: IconName }[] = [
    { id: "workspace", name: "Робочий простір", icon: "grid" },
    { id: "activity", name: "Історія запусків", icon: "activity" },
    { id: "connections", name: "Інтеграції", icon: "plug" },
  ];

  return <div className="app-root">
    <aside className={"sidebar " + (menuOpen ? "sidebar-open" : "")}>
      <div className="sidebar-head">
        <Link href="/" onClick={() => go("workspace")} className="brand-lockup" aria-label="ARTSS — робочий простір">
          <span className="brand-icon"><Icon name="spark" size={25} /></span>
          <span className="brand-copy"><strong>ARTSS<span> / AI</span></strong><small>AGENT CONTROL CENTER</small></span>
        </Link>
        <button className="mobile-close icon-button" aria-label="Закрити меню" onClick={() => setMenuOpen(false)}><Icon name="close" /></button>
      </div>
      <div className="sidebar-section-label">WORKSPACE <span>01</span></div>
      <nav className="side-nav" aria-label="Головна навігація">
        {nav.map(item => <button key={item.id} type="button" aria-current={view === item.id ? "page" : undefined} className={"nav-item " + (view === item.id ? "active" : "")} onClick={() => go(item.id)}><Icon name={item.icon} size={18} /><span>{item.name}</span>{item.id === "activity" && runs.length > 0 ? <em>{runs.length}</em> : null}{view === item.id ? <Icon name="chevron" size={14} /> : null}</button>)}
      </nav>
      <div className="sidebar-divider" />
      <div className="sidebar-section-label">AI ENGINE <span>02</span></div>
      <div className="engine-card">
        <div className="engine-card-top"><span className="engine-avatar"><Icon name="spark" size={18} /></span><span className="engine-label">Мультимодельний агент</span></div>
        <div className="engine-card-title">ARTSS Intelligence</div>
        <div className="engine-status"><span className={"status-light " + (available.length > 0 ? "online" : "")} />{loadingHealth ? "Перевірка…" : available.length > 0 ? String(available.length) + " AI-провайдерів налаштовано" : "Ключі не налаштовано"}</div>
      </div>
      <div className="sidebar-bottom">
        <div className="sidebar-mini"><span className="sidebar-mini-icon"><Icon name="shield" size={18} /></span><span><strong>Приватний доступ</strong><small>Захищена панель ARTSS</small></span></div>
        <button className="sidebar-signout" type="button" onClick={logout}><Icon name="logout" size={17} /> Вийти із системи <Icon name="arrow" size={15} /></button>
        <span className="sidebar-version">ARTSS © 2026 <span>CONTROL / 2.0</span></span>
      </div>
    </aside>
    {menuOpen ? <button className="sidebar-backdrop" aria-label="Закрити меню" onClick={() => setMenuOpen(false)} /> : null}

    <div className="page-stage">
      <header className="app-topbar">
        <div className="top-left">
          <button className="mobile-menu icon-button" aria-label="Відкрити меню" onClick={() => setMenuOpen(true)}><Icon name="menu" size={22} /></button>
          <span className="breadcrumb">ARTSS <Icon name="chevron" size={13} /> <strong>{view === "workspace" ? "Командний центр" : view === "activity" ? "Запуски" : "Інтеграції"}</strong></span>
        </div>
        <div className="top-right">
          <span className={"top-status " + (health ? "healthy" : "")}><span className="status-light" />{loadingHealth ? "Перевірка" : health ? "API ONLINE" : "API OFFLINE"}</span>
          <button type="button" className="top-icon" onClick={() => { setLoadingHealth(true); void refresh(); }} title="Оновити статус" aria-label="Оновити статус"><Icon name="refresh" size={17} /></button>
          <span className="top-avatar">A</span>
        </div>
      </header>

      <main className="main-content">
        {view === "workspace" ? <>
          <section className="hero">
            <div className="hero-glow" aria-hidden="true" /><div className="hero-grid" aria-hidden="true" />
            <div className="hero-content">
              <div className="hero-eyebrow"><span className="eyebrow-line" /> ПЕРСОНАЛЬНА AI-СИСТЕМА <span className="hero-beta">V2 / WORKSPACE</span></div>
              <h1>Ідеї у дії.<br /><span>Код під контролем.</span></h1>
              <p>Один простір для AI-агентів, розробки, автоматизації та інфраструктури. Від запиту — до результату.</p>
              <div className="hero-actions"><button type="button" className="hero-primary" onClick={() => { inputRef.current?.focus(); inputRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }); }}>Почати роботу <Icon name="arrow" size={18} /></button><button type="button" className="hero-secondary" onClick={() => go("connections")}><Icon name="plug" size={16} /> Перевірити сервіси</button></div>
            </div>
            <div className="hero-orbit" aria-hidden="true"><span className="orbit-ring orbit-one" /><span className="orbit-ring orbit-two" /><span className="orbit-core"><Icon name="spark" size={49} strokeWidth={1.25} /></span><span className="orbit-node n-one" /><span className="orbit-node n-two" /><span className="orbit-node n-three" /></div>
            <div className="hero-footer"><span><span className="status-light online" /> PRIVATE WORKSPACE</span><span>DESIGNED FOR EXECUTION / NOT JUST CHAT</span></div>
          </section>

          <section className="overview-grid" aria-label="Огляд системи">
            <article className="metric-card"><div className="metric-top"><span>AI-провайдери</span><Icon name="layers" size={19} /></div><div className="metric-number">{available.length.toString().padStart(2, "0")} <span>/ 03</span></div><div className="metric-foot"><span className={"tiny-dot " + (available.length > 0 ? "green" : "amber")} />{available.length ? "Ключі налаштовані" : "Потрібна конфігурація"}</div></article>
            <article className="metric-card"><div className="metric-top"><span>Підключення</span><Icon name="plug" size={19} /></div><div className="metric-number">{readyCount.toString().padStart(2, "0")} <span>/ 03</span></div><div className="metric-foot"><span className="tiny-dot green" />За конфігурацією API</div></article>
            <article className="metric-card"><div className="metric-top"><span>Задачі у сесії</span><Icon name="activity" size={19} /></div><div className="metric-number">{runs.length.toString().padStart(2, "0")}</div><div className="metric-foot"><span className="tiny-dot cyan" />{runs.filter(r => r.status === "done").length} завершено</div></article>
            <article className="metric-card metric-runtime"><div className="metric-top"><span>Режим агента</span><Icon name="bolt" size={19} /></div><div className="runtime-label">{health?.executionEnabled ? "EXECUTION" : "PREVIEW"}</div><div className="metric-foot"><span className={"tiny-dot " + (health?.executionEnabled ? "green" : "amber")} />{health?.executionEnabled ? "Запис змін дозволено" : "Запис змін вимкнено"}</div></article>
          </section>

          <section className="working-grid">
            <div className="primary-column">
              <div className="section-caption"><div><span className="overline">01 / AGENT STUDIO</span><h2>Робоча консоль</h2></div><button type="button" className="subtle-action" onClick={() => { setMessages([]); setNotice("Створено нову розмову"); }} disabled={busy || messages.length === 0}><Icon name="plus" size={15} /> Нова розмова</button></div>
              <div className="chat-panel">
                <div className="chat-panel-top"><span className="console-icon"><Icon name="terminal" size={17} /></span><div><strong>ARTSS AGENT</strong><small>Інтерактивна консоль завдань</small></div><span className="console-state"><span className={"tiny-dot " + (busy ? "amber" : available.length > 0 ? "green" : "")} />{busy ? "ВИКОНУЄТЬСЯ" : "READY"}</span></div>
                {messages.length === 0 ? <div className="chat-welcome"><div className="welcome-symbol"><Icon name="spark" size={27} strokeWidth={1.4} /></div><h3>Що створимо сьогодні?</h3><p>Опишіть задачу своїми словами. Агент проаналізує контекст, підготує рішення та повідомить фактичний результат.</p><span>Оберіть швидкий старт нижче або введіть власний запит.</span></div> : <div className="chat-messages" ref={threadRef} role="log" aria-live="polite" aria-label="Розмова з агентом">{messages.map((item, i) => <article className={"chat-message " + item.role} key={String(item.timestamp) + "-" + i}><div className="chat-message-head"><span>{item.role === "assistant" ? "✳ ARTSS" : "ВИ"}</span><span>{item.meta || compactTime(item.timestamp)}</span></div><div className="chat-bubble">{item.content}</div>{item.role === "assistant" ? <button type="button" className="copy-action" onClick={() => { void copyMessage(item.content); }} aria-label="Копіювати відповідь"><Icon name="copy" size={14} /> Копіювати</button> : null}</article>)}{busy ? <div className="processing" role="status"><span className="pulse-dots"><i /><i /><i /></span> Агент аналізує задачу…</div> : null}</div>}
                {messages.length === 0 ? <div className="quick-starts">{templates.map(item => <button type="button" key={item.number} onClick={() => choose(item.text)} className="quick-card"><span className="quick-id">{item.number} <span>{item.category}</span></span><span className="quick-title">{item.title}</span><Icon name="arrow" size={17} /></button>)}</div> : null}
                <form className="chat-composer" onSubmit={send}>
                  <label htmlFor="agent-input" className="sr-only">Ваш запит до AI-агента</label>
                  <textarea id="agent-input" ref={inputRef} rows={3} maxLength={12000} value={input} disabled={busy} onChange={event => setInput(event.target.value)} onKeyDown={onComposerKeyDown} placeholder="Опишіть завдання для вашого AI-агента…" />
                  <div className="composer-controls"><span><Icon name="shield" size={14} /> Приватна робоча сесія</span><div className="composer-right"><span className="char-count">{input.length} / 12000</span><button type="submit" className="composer-submit" disabled={busy || !input.trim() || (health !== null && !selectedReady)}>{busy ? "Виконується" : "Надіслати"} <Icon name={busy ? "clock" : "arrowup"} size={17} /></button></div></div>
                </form>
              </div>
              {healthError ? <div className="inline-error" role="alert">{healthError} <button type="button" onClick={() => { void refresh(); }}>Спробувати знову</button></div> : null}
              {health !== null && available.length === 0 ? <div className="inline-error">Для запуску агента налаштуйте API-ключ провайдера на сервері.</div> : null}
              {notice ? <div className="toast" role="status"><Icon name="check" size={17} /><span>{notice}</span><button type="button" aria-label="Закрити" onClick={() => setNotice("")}><Icon name="close" size={15} /></button></div> : null}
            </div>
            <aside className="secondary-column">
              <div className="section-caption"><div><span className="overline">02 / MODEL ROUTING</span><h2>Моделі AI</h2></div><span className="caption-side">Вибір агента</span></div>
              <div className="model-panel">
                {modelCards.map(item => {
                  const isReady = item.id === "multi" ? available.length > 0 : available.includes(item.id);
                  return <button type="button" key={item.id} className={"model-option " + (mode === item.id ? "selected" : "")} onClick={() => setMode(item.id)} disabled={busy} aria-pressed={mode === item.id}><span className={"model-emblem " + item.id}>{item.icon}</span><span className="model-info"><strong>{item.name}</strong><small>{item.caption}</small></span><span className={"model-presence " + (isReady ? "configured" : "")}>{isReady ? "ACTIVE" : "OFF"}</span><span className="model-radio">{mode === item.id ? <span /> : null}</span></button>;
                })}
                <div className="model-note"><Icon name="shield" size={16} /><span>Статус показує конфігурацію, не гарантує доступність AI API. При збої провайдера використовується резервний.</span></div>
              </div>
              <div className="connection-summary">
                <div className="connection-header"><span><Icon name="activity" size={18} /> Стан системи</span><button type="button" onClick={() => { setLoadingHealth(true); void refresh(); }} aria-label="Оновити стан"><Icon name="refresh" size={16} /></button></div>
                {services.map(service => <div className="connection-row" key={service.id}><span>{service.name}</span><span className={"connection-status " + (health?.integrations[service.id] ? "up" : "")}><i />{loadingHealth ? "…" : health?.integrations[service.id] ? "Configured" : "Not configured"}</span></div>)}
                <div className="connection-footer"><span>Оновлено {lastSync || "—"}</span><button type="button" onClick={() => go("connections")}>Детальніше <Icon name="arrow" size={15} /></button></div>
              </div>
            </aside>
          </section>
        </> : view === "activity" ? <section className="inner-page">
          <div className="inner-kicker">ACTIVITY / EXECUTION HISTORY</div><h1>Історія <span>запусків.</span></h1><p className="inner-subtitle">Результати запитів у поточній сесії. Немає вигаданих запусків — лише реальні відповіді API.</p>
          <div className="activity-summary"><div><span>УСЬОГО ЗАПИТІВ</span><strong>{runs.length}</strong></div><div><span>ЗАВЕРШЕНО</span><strong>{runs.filter(r=>r.status==="done").length}</strong></div><div><span>ПОМИЛКИ</span><strong>{runs.filter(r=>r.status==="error").length}</strong></div></div>
          {runs.length === 0 ? <div className="empty-activity"><span><Icon name="activity" size={36} /></span><h2>Тут з&apos;являться ваші задачі</h2><p>Відправте перший запит через консоль агента.</p><button type="button" className="hero-primary" onClick={() => go("workspace")}>Відкрити консоль <Icon name="arrow" size={17} /></button></div> : <div className="activity-list">{runs.map(run => <article className="activity-item" key={run.id}><span className={"activity-icon " + run.status}>{run.status === "done" ? <Icon name="check" size={19} /> : run.status === "error" ? "!" : <Icon name="clock" size={19} />}</span><div className="activity-info"><h3>{run.task}</h3><p>{run.provider} · {compactTime(run.id)}{run.duration === undefined ? "" : " · " + run.duration.toFixed(1) + " с"}</p>{run.prUrl && run.prUrl.startsWith("https://github.com/") ? <a target="_blank" rel="noreferrer" href={run.prUrl}>Відкрити pull request <Icon name="external" size={13} /></a> : null}</div><span className={"activity-state " + run.status}>{run.status==="done"?"Завершено":run.status==="error"?"Помилка":"В роботі"}</span></article>)}</div>}<p className="footnote">Історія цієї сторінки зберігається тільки до перезавантаження вкладки; сервер може зберігати окремі записи у Supabase.</p>
        </section> : <section className="inner-page">
          <div className="inner-kicker">SYSTEM / INFRASTRUCTURE</div><h1>Єдина <span>екосистема.</span></h1><p className="inner-subtitle">Актуальний стан основних сервісів ARTSS. Перевірка конфігурації не означає перевірку прав доступу або доступності API.</p>
          <div className="connection-grid">{services.map(service => <article key={service.id} className="connection-card"><div className="connection-card-top"><span className="connection-logo">{service.monogram}</span><span className={"connection-status " + (health?.integrations[service.id] ? "up" : "")}><i />{health?.integrations[service.id] ? "Configured" : "Not configured"}</span></div><h2>{service.name}</h2><p>{service.info}</p><a target="_blank" rel="noreferrer" href={service.href}>Відкрити панель <Icon name="external" size={15} /></a></article>)}</div>
          <div className="system-banner"><span className="system-banner-icon"><Icon name="shield" size={24} /></span><div><strong>Захищена архітектура</strong><p>Ключі залишаються на сервері. Автоматичне внесення змін у GitHub наразі {health?.executionEnabled ? "увімкнене" : "вимкнене"}. Публікація у production потребує перевіреного процесу.</p></div></div>
          <div className="connection-tools"><button type="button" className="hero-primary" onClick={() => { setLoadingHealth(true); void refresh(); }}>Оновити діагностику <Icon name="refresh" size={17} /></button><span>Остання перевірка: {lastSync || "—"}</span></div>
        </section>}
      </main>
      <footer className="stage-footer"><span>ARTSS <strong>AI</strong> / CONTROL CENTER</span><span>PRIVATE SYSTEM · DEVELOPED FOR WHAT&apos;S NEXT</span><span>2026 © ARTSS</span></footer>
    </div>
  </div>;
}
