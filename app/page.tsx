"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AgentComposer, type ComposerHandle } from "./agent-composer";
import { ArtssMark } from "./artss-mark";
import Image from "next/image";
import { type ChangeEvent } from "react";

type Provider = "openai" | "deepseek" | "gemini" | "claude" | "mistral";
type Mode = Provider | "multi";
type Message = { role: "user" | "assistant"; content: string; meta?: string; imageUrl?: string };
type Run = { id: number; title: string; model: string; status: "running" | "done" | "error"; seconds?: number; note?: string; prUrl?: string; deploymentUrl?: string };
type Health = {
  ok: boolean;
  providers: { configured: Provider[] };
  integrations: { github: boolean; vercel: boolean; supabase: boolean };
  executionEnabled: boolean;
};
type AgentReply = { text?: string; error?: string; provider?: string; contributors?: string[]; action?: string; prUrl?: string; deploymentUrl?: string; image?: string };

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
  const [storedRuns, setStoredRuns] = useState<Run[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [showAllModels, setShowAllModels] = useState(false);
  const [showAllRuns, setShowAllRuns] = useState(false);
  const [toolMode, setToolMode] = useState<"agent" | "image" | "web">("agent");
  const [menu, setMenu] = useState<"notifications" | "profile" | null>(null);
  const composerRef = useRef<ComposerHandle>(null);
  const modelRef = useRef<HTMLDivElement>(null);
  const shortcutRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const servicesRef = useRef<HTMLElement>(null);
  const inFlightHealth = useRef(false);
  const recentRuns = runs.length ? runs : storedRuns;
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

  useEffect(() => {
    let active = true;
    void fetch("/api/runs", { cache: "no-store" }).then(response => response.ok ? response.json() : null)
      .then((data: { runs?: { id?: string; title?: string; status?: string; created_at?: string | null }[] } | null) => {
        if (!active || !Array.isArray(data?.runs)) return;
        const historic: Run[] = data.runs.map((run, i) => ({
          id: run.created_at ? Date.parse(run.created_at) || -(i + 1) : -(i + 1),
          title: run.title || "Agent task",
          status: run.status === "done" ? "done" : run.status === "error" ? "error" : "running",
          model: "ARTSS Agent",
        }));
        setStoredRuns(historic);
      }).catch(() => { /* Optional storage: keep local runs visible. */ });
    return () => { active = false; };
  }, []);

  function chooseTask(text: string) {
    setToolMode("agent");
    composerRef.current?.fill(text);
  }
  function setTool(mode: "agent" | "image" | "web") {
    setToolMode(mode);
    composerRef.current?.focus();
  }
  async function attachFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 40_000) { setNotice("Файл завеликий. Максимум 40 КБ."); return; }
    if (!/\.(txt|md|json|ts|tsx|js|jsx|css|html|yaml|yml|sql|log|py|go|rs)$/i.test(file.name)) {
      setNotice("Підтримуються лише текстові та кодові файли."); return;
    }
    try {
      const content = await file.text();
      setToolMode("agent");
      composerRef.current?.fill("Файл: " + file.name + "\n\n" + content.slice(0, 11000));
      setNotice("Файл " + file.name + " додано в запит.");
    } catch { setNotice("Не вдалося відкрити файл."); }
  }
  function jumpTo(id: "models" | "integrations" | "chat") {
    const target = id === "models" ? modelRef.current : id === "integrations" ? servicesRef.current : document.getElementById("agent-composer");
    target?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
  }

  async function submit(text: string) {
    const task = text.trim();
    if (!task || busy || (toolMode === "agent" && health && !ready)) return;
    const started = performance.now();
    const id = Date.now();
    const conversation: Message[] = [...messages.slice(-18), { role: "user", content: task }];
    setMessages(conversation);
    const modeForRequest = toolMode;
    const runModel = modeForRequest === "image" ? "Генерація зображення" : modeForRequest === "web" ? "Веб-пошук" : selected;
    setRuns(previous => [{ id, title: task, model: runModel, status: "running" as const }, ...previous].slice(0, 40));
    setBusy(true);
    setNotice("");
    try {
      const endpoint = modeForRequest === "image" ? "/api/images" : modeForRequest === "web" ? "/api/web-search" : "/api/agent";
      const payload = modeForRequest === "image" ? { prompt: task } : modeForRequest === "web" ? { question: task } :
        { provider: selected, messages: conversation.map(({ role, content }) => ({ role, content })) };
      const response = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result: AgentReply = await response.json().catch(() => ({}));
      if (response.status === 401) {
        setRuns(previous => previous.map(run => run.id === id ? { ...run, status: "error" } : run));
        router.push("/login");
        return;
      }
      if (!response.ok) throw new Error(result.error || "Запит завершився помилкою.");
      const model = result.provider || runModel;
      const description = [model, result.action === "executed" ? "Зміни збережено" : result.action === "preview" ? "Підготовлено зміни" : modeForRequest === "image" ? "Зображення" : "Відповідь"].join(" · ");
      if (modeForRequest === "image" && (!result.image || !result.image.startsWith("data:image/png;base64,"))) {
        throw new Error("Сервіс не повернув зображення.");
      }
      setMessages(previous => [...previous.slice(-39), {
        role: "assistant", content: modeForRequest === "image" ? "Згенероване зображення: " + task : result.text || "Агент не повернув текст.",
        meta: description, imageUrl: modeForRequest === "image" ? result.image : undefined,
      }]);
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

  return <div className="pm-shell neo-app flagship-app">
    <header className="pm-header neo-header">
      <Link className="pm-brand" href="/" aria-label="ARTSS AI — головна">
        <span className="pm-brand-mark flagship-logo"><ArtssMark size={48}/></span>
        <span className="pm-brand-label">ARTSS<span className="pm-dot">●</span>AI<small>PRIVATE AGENT STUDIO</small></span>
      </Link>
      <div className="pm-header-right">
        <span className={"pm-live " + (health ? "up" : "")} title={health ? "API відповідає" : "API не перевірено"}><i /><span className="neo-status-caption">{loading ? "Перевірка" : health ? "API онлайн" : "Офлайн"}</span></span>
        <button type="button" className={"pm-round-icon flagship-alert-button" + (menu === "notifications" ? " selected" : "")} onClick={() => setMenu(x => x === "notifications" ? null : "notifications")} aria-expanded={menu === "notifications"} aria-label="Сповіщення та запуски">♧{recentRuns.some(r => r.status === "running") ? <span className="flagship-alert-dot"/> : null}</button>
        <button type="button" className={"pm-round-icon flagship-profile-button" + (menu === "profile" ? " selected" : "")} onClick={() => setMenu(x => x === "profile" ? null : "profile")} aria-expanded={menu === "profile"} aria-label="Профіль та вихід">♙</button>
        {menu ? <div className="flagship-header-menu" role="region" aria-label={menu === "profile" ? "Профіль" : "Сповіщення"}>
          {menu === "profile" ? <><strong>Приватний простір ARTSS AI</strong><p>Доступ до AI, інтеграцій та робочих сценаріїв.</p>
          <button type="button" onClick={() => { setMenu(null); setLoading(true); void refresh(); }}><Icon name="refresh" size={16}/> Оновити стан</button>
          <button type="button" onClick={() => { void logout(); }}><Icon name="logout" size={16}/> Вийти</button></> :
          <><strong>Запуски та сповіщення</strong>{recentRuns.length ? recentRuns.slice(0,4).map(run =>
            <p key={run.id} className="flagship-menu-run"><span>{run.status === "done" ? "✓" : run.status === "error" ? "!" : "◷"}</span>{run.title.slice(0,78)}</p>) :
            <p>Нових запусків немає. Завдання з'являться після запиту.</p>}
          <button type="button" onClick={() => { setMenu(null); document.getElementById("runs-title")?.scrollIntoView({ block: "center", behavior: "smooth" }); }}>Переглянути запуски <Icon name="chevron" size={16}/></button></>}
        </div> : null}
      </div>
    </header>
    <main className="pm-main neo-main">
      <section className="pm-hero neo-hero" aria-labelledby="neo-title">
        <div className="pm-hero-copy">
          <span className="pm-kicker"><span className="pm-kicker-mark">✦</span> НОВИЙ РІВЕНЬ ВАШИХ ІДЕЙ</span>
          <h1 id="neo-title">Створюйте більше.<br /><span>Без зайвого.</span></h1>
          <p>Усі ваші AI-інструменти в одному просторі. Один запит — команда моделей.</p>
          <div className="neo-hero-actions">
            <button type="button" className="neo-pill neo-pill-main" onClick={() => jumpTo("models")}>✦ <strong>{configured.length} активних ключів</strong><Icon name="chevron" size={15}/></button>
            <button type="button" className="neo-pill" onClick={() => { setSelected("multi"); jumpTo("models"); }}><Icon name="shield" size={16}/> Розумний fallback <Icon name="chevron" size={14}/></button>
            <button type="button" className="neo-pill" onClick={() => jumpTo("chat")}>◈ Приватний простір <Icon name="chevron" size={14}/></button>
          </div>
        </div>
        <div className="neo-orb flagship-orb" aria-hidden="true"/>
      </section>

      <section className="pm-panel neo-section" aria-labelledby="models-title">
        <div className="neo-section-head">
          <h2 id="models-title"><span className="neo-heading-symbol">⬡</span> AI МОДЕЛІ</h2>
          <button type="button" className="neo-show-more" aria-expanded={showAllModels} onClick={() => setShowAllModels(x => !x)}>{showAllModels ? "Згорнути" : "Показати всі"} <Icon name="chevron" size={16}/></button>
        </div>
        <div className={"pm-carousel neo-model-strip " + (showAllModels ? "neo-expanded" : "")} ref={modelRef} aria-label="Моделі штучного інтелекту">
          {models.map(m => {
            const active = m.id === "multi" ? configured.length > 0 : configured.includes(m.id);
            return <button type="button" key={m.id} disabled={busy} aria-pressed={selected === m.id}
              className={"neo-model neo-model-" + m.color + (selected === m.id ? " chosen" : "")}
              onClick={() => setSelected(m.id)}>
              <span className="neo-model-symbol">{m.symbol}</span>
              <span className={"neo-model-indicator" + (active ? " on" : "")} title={active ? "Ключ налаштовано" : "Потрібен ключ"}/>
              <strong>{m.title}</strong><small>{m.subtitle}</small>
              <span className="neo-model-status">{loading ? "Перевірка" : active ? "Доступний ключ" : "Немає ключа"}</span>
            </button>;
          })}
        </div>
        {!ready && health ? <p className="neo-inline-alert">Для вибраної моделі немає ключа. Оберіть активну модель.</p> : null}
      </section>

      <section className="pm-panel neo-section" aria-labelledby="tasks-title">
        <div className="neo-section-head"><h2 id="tasks-title"><span className="neo-heading-symbol sun">ϟ</span> ШВИДКІ ДІЇ</h2></div>
        <div className="pm-carousel neo-action-strip" ref={shortcutRef}>
          <button className="neo-action" type="button" onClick={() => { if (!busy) { setToolMode("agent"); setMessages([]); composerRef.current?.fill(""); jumpTo("chat"); } }}>
            <span className="neo-action-symbol">▤</span><strong>Новий запит</strong><small>Текст, код, аналіз</small><Icon name="chevron" size={15}/>
          </button>
          <button className="neo-action neo-action-image" type="button" onClick={() => { setTool("image"); jumpTo("chat"); }}><span className="neo-action-symbol">▧</span><strong>Генерувати зображення</strong><small>OpenAI Images</small><Icon name="chevron" size={15}/></button>
          {shortcuts.slice(0,2).map(x => <button type="button" className={"neo-action neo-action-" + x.id} key={x.id} onClick={() => { chooseTask(x.value); jumpTo("chat"); }}>
            <span className="neo-action-symbol">{x.symbol}</span><strong>{x.title === "План" ? "Агент-режим" : x.title === "Код" ? "Робота з кодом" : "Аудит системи"}</strong><small>{x.caption}</small><Icon name="chevron" size={15}/>
          </button>)}
        </div>
      </section>

      <section className="pm-panel neo-section" aria-labelledby="integrations-title" ref={servicesRef}>
        <div className="neo-section-head"><h2 id="integrations-title"><span className="neo-heading-symbol gold">♧</span> ІНТЕГРАЦІЇ ТА СТАТУС</h2><button className="neo-show-more" type="button" onClick={() => { setLoading(true); void refresh(); }}>Оновити <Icon name="refresh" size={14}/></button></div>
        <div className="neo-service-strip">
          {integrations.map(s => <a className="neo-service-card" href={s.href} key={s.key} target="_blank" rel="noreferrer">
            <span className={"neo-service-logo neo-service-" + s.key}>{s.mark}</span>
            <span className="neo-service-text"><strong>{s.title}</strong><small>{loading ? "Перевірка" : health?.integrations[s.key] ? "Ключ налаштовано" : "Не налаштовано"}</small></span>
            <i className={"neo-service-dot" + (health?.integrations[s.key] ? " active" : "")} aria-hidden="true"/>
          </a>)}
        </div>
        <p className="neo-small-note">Статус показує наявність конфігурації, а не результат окремого API-запиту. Автоматичні зміни: {health?.executionEnabled ? "увімкнені" : "вимкнені"}.</p>
      </section>

      <section className="pm-panel neo-section" aria-labelledby="runs-title">
        <div className="neo-section-head">
          <h2 id="runs-title"><span className="neo-heading-symbol gold">◷</span> НЕДАВНІ ЗАПУСКИ</h2>
          <button type="button" className="neo-show-more" onClick={() => setShowAllRuns(x => !x)} aria-expanded={showAllRuns}>{showAllRuns ? "Згорнути" : "Усі запуски"} <Icon name="chevron" size={15}/></button>
        </div>
        <div className="neo-runs">
          {!recentRuns.length ? <div className="neo-no-runs"><span>◎</span><div><strong>Поки що немає запусків</strong><p>Результати реальних задач з&apos;являться тут після першого запиту.</p></div></div> :
            recentRuns.slice(0,showAllRuns ? 40 : 3).map(r => <div className="neo-run-row" key={r.id}>
              <span className={"neo-run-logo " + r.status}>{r.status === "done" ? "✓" : r.status === "error" ? "!" : "⌘"}</span>
              <span className="neo-run-info"><strong>{r.title}</strong><small>{r.model} · {r.id > 0 ? displayTime(r.id) : "—"} {r.seconds ? "· " + r.seconds.toFixed(1) + " c" : ""}</small>{r.prUrl?.startsWith("https://github.com/") ? <a href={r.prUrl} target="_blank" rel="noreferrer">Відкрити PR ↗</a> : null}</span>
              <span className={"neo-run-pill " + r.status}>{r.status === "done" ? "✓ Готово" : r.status === "error" ? "Помилка" : "Виконується"}</span>
            </div>)}
        </div>
      </section>

      <section className="neo-chat-section" id="agent-composer" aria-label="AI-чат">
        {messages.length ? <div className="pm-thread neo-thread" ref={threadRef} role="log" aria-live="polite">
          {messages.map((message, index) => <article className={"pm-message " + message.role} key={index}>
            <span className="pm-message-label">{message.role === "user" ? "ВИ" : "ARTSS AI"} <small>{message.meta || ""}</small></span>
            <div className="pm-bubble">{message.content}{message.imageUrl ? <Image className="flagship-generated-image" src={message.imageUrl} alt="Зображення, створене агентом" width={1024} height={1024} unoptimized/> : null}</div>
            {message.role === "assistant" ? <button type="button" className="pm-copy" onClick={() => { void copy(message.content); }}><Icon name="copy" size={14}/> Копіювати</button> : null}
          </article>)}</div> : null}
        {busy ? <p className="pm-thinking" role="status"><span className="pm-pulse"/>Агент обробляє запит…</p> : null}
        <AgentComposer ref={composerRef} model={toolMode === "image" ? "Генерація зображень" : toolMode === "web" ? "Веб-пошук" : models.find(x=>x.id===selected)?.title || selected} busy={busy} unavailable={toolMode === "agent" && health !== null && !ready} onSend={submit}/>
        <div className="neo-composer-tools">
          <button type="button" className={toolMode === "agent" ? "tool-active" : ""} onClick={() => { setTool("agent"); setSelected("multi"); }}>✦ Multi AI</button>
          <button type="button" className={toolMode === "web" ? "tool-active" : ""} onClick={() => setTool("web")}>◎ Веб-пошук</button>
          <label className="flagship-file-trigger">▤ Файли<input type="file" accept=".txt,.md,.json,.ts,.tsx,.js,.jsx,.css,.html,.yaml,.yml,.sql,.log,.py,.go,.rs,text/*" onChange={e => { void attachFile(e); }}/></label>
          <button type="button" className={toolMode === "image" ? "tool-active" : ""} onClick={() => setTool("image")}>▧ Зображення</button>
          <button type="button" onClick={() => { chooseTask(shortcuts[1].value); }}>〈/〉 Код</button>
          <button type="button" onClick={() => { chooseTask(shortcuts[2].value); }}>⊞ Аудит</button>
          <button type="button" onClick={() => { chooseTask(shortcuts[0].value); }}>✧ План</button>
        </div>
        {healthError ? <div className="pm-notice-error" role="alert">{healthError}<button type="button" onClick={() => { void refresh(); }}>Повторити</button></div> : null}
        {!loading && health && !configured.length ? <div className="pm-notice-error">Жоден AI-провайдер не має налаштованого ключа.</div> : null}
      </section>

      {notice ? <div className="pm-toast" role="status"><Icon name="check" size={16}/><span>{notice}</span><button type="button" onClick={() => setNotice("")} aria-label="Закрити">×</button></div> : null}
      <footer className="pm-footer"><span>ARTSS AI <span className="pm-dot">●</span> PRIVATE AGENT STUDIO</span><span>Зв&apos;язок перевірено: {lastCheck || "—"}</span></footer>
    </main>
  </div>;
}
