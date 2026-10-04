"use client";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
type Provider = "openai" | "deepseek" | "gemini";
type Tab = "agent" | "runs" | "integrations";
type Message = { role: "user" | "assistant"; content: string; meta?: string };
type Health = { providers: { configured: Provider[] }; integrations: { github: boolean; vercel: boolean; supabase: boolean }; executionEnabled: boolean };
type Run = { id: number; task: string; provider: string; status: "running" | "done" | "error"; seconds?: number };
const providers: { id: Provider; name: string; mark: string; note: string }[] = [
 { id: "openai", name: "OpenAI", mark: "◈", note: "Код і міркування" },
 { id: "deepseek", name: "DeepSeek", mark: "≈", note: "Аналіз і розробка" },
 { id: "gemini", name: "Gemini", mark: "✦", note: "Контекст і дослідження" },
];
const prompts = [
 { title: "Розібрати проєкт", text: "Проаналізуй проєкт і поясни його архітектуру. Не внось змін.", icon: "⌘" },
 { title: "Знайти помилку", text: "Перевір код на помилки та запропонуй конкретні виправлення.", icon: "↗" },
 { title: "Підготувати PR", text: "Підготуй покращення мобільного інтерфейсу й створи pull request.", icon: "+" },
 { title: "Перевірити деплой", text: "Перевір налаштування Vercel і можливі блокери деплою. Не внось змін.", icon: "△" },
];
export default function Home() {
 const router = useRouter();
 const [tab, setTab] = useState<Tab>("agent");
 const [messages, setMessages] = useState<Message[]>([]);
 const [input, setInput] = useState("");
 const [provider, setProvider] = useState<Provider>("openai");
 const [busy, setBusy] = useState(false);
 const [health, setHealth] = useState<Health | null>(null);
 const [healthError, setHealthError] = useState("");
 const [checking, setChecking] = useState(true);
 const [runs, setRuns] = useState<Run[]>([]);
 const [notice, setNotice] = useState("");
 const inputRef = useRef<HTMLTextAreaElement>(null);
 const endRef = useRef<HTMLDivElement>(null);
 const refreshHealth = useCallback(() => fetch("/api/health", { cache: "no-store" })
  .then(async response => {
   if (!response.ok) throw new Error("Не вдалося перевірити конфігурацію сервера.");
   const data = await response.json() as Health;
   if (!Array.isArray(data.providers?.configured) || !data.integrations) throw new Error("Сервер повернув невідомий формат стану.");
   return data;
  }).then(data => {
   setHealth(data);
   setProvider(current => data.providers.configured.includes(current) ? current : data.providers.configured[0] || current);
   setHealthError("");
  }).catch(error => {
   setHealth(null); setHealthError(error instanceof Error ? error.message : "Стан недоступний.");
  }).finally(() => setChecking(false)), []);
 useEffect(() => { void refreshHealth(); }, [refreshHealth]);
 useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [messages, busy]);
 function choosePrompt(text: string) { setInput(text); inputRef.current?.focus(); }
 async function send(event: FormEvent) {
  event.preventDefault();
  const text = input.trim(); if (!text || busy) return;
  const id = Date.now(), start = performance.now();
  const next: Message[] = [...messages, { role: "user", content: text }];
  setMessages(next); setInput(""); setBusy(true); setNotice("");
  setRuns(current => [{ id, task: text, provider, status: "running" }, ...current]);
  try {
   const response = await fetch("/api/agent", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: next, provider }) });
   const data = await response.json();
   if (response.status === 401) {
    setRuns(current => current.map(run => run.id === id ? { ...run, status: "error" } : run)); router.push("/login"); return;
   }
   if (!response.ok) throw new Error(data.error || "Запит до агента завершився помилкою.");
   const actualProvider = data.provider || provider;
   const meta = [actualProvider, data.action === "executed" ? "Зміни записано" : data.action === "preview" ? "Підготовлено зміни" : "Відповідь"].join(" · ");
   setMessages(current => [...current, { role: "assistant", content: data.text, meta }]);
   setRuns(current => current.map(run => run.id === id ? { ...run, status: "done", provider: actualProvider, seconds: (performance.now() - start) / 1000 } : run));
  } catch (error) {
   const message = error instanceof Error ? error.message : "Помилка агента.";
   setMessages(current => [...current, { role: "assistant", content: message, meta: "Помилка запиту" }]);
   setRuns(current => current.map(run => run.id === id ? { ...run, status: "error", seconds: (performance.now() - start) / 1000 } : run));
  } finally { setBusy(false); }
 }
 const available = health?.providers.configured || [];
 const services = [
  { name: "GitHub", mark: "⌘", detail: "Код, гілки та pull requests", configured: health?.integrations.github, planned: false },
  { name: "Vercel", mark: "▲", detail: "Збірки та preview-деплої", configured: health?.integrations.vercel, planned: false },
  { name: "Supabase", mark: "ϟ", detail: "Збереження сесій і запусків", configured: health?.integrations.supabase, planned: false },
  { name: "Replit", mark: "▧", detail: "Окреме середовище розробки", configured: undefined, planned: true },
  { name: "Canva", mark: "C", detail: "Дизайн і візуальні матеріали", configured: undefined, planned: true },
  { name: "Template Creator", mark: "◇", detail: "Особисті шаблони артефактів", configured: undefined, planned: true },
 ];
 return <main className="shell">
  <header className="topbar"><Link className="identity" href="/" aria-label="ARTSS — головна"><span className="brandmark">a<span>↗</span></span><span><strong>ARTSS<span className="brand-dot">.</span></strong><small>особистий простір AI</small></span></Link><div className="top-actions"><span className={`status ${busy ? "live" : ""}`}><i />{busy ? "Працює" : "Ваш простір"}</span><Link className="avatar" href="/login" aria-label="Увійти в панель">A</Link></div></header>
  <nav className="mainnav" aria-label="Розділи панелі">{([{ id: "agent", title: "Агент", icon: "✦" }, { id: "runs", title: "Запуски", icon: "↗" }, { id: "integrations", title: "Інтеграції", icon: "▦" }] as const).map(item => <button key={item.id} onClick={() => { setTab(item.id); setNotice(""); }} className={tab === item.id ? "active" : ""} aria-current={tab === item.id ? "page" : undefined}><span aria-hidden="true">{item.icon}</span>{item.title}{item.id === "runs" && runs.length > 0 ? <b>{runs.length}</b> : null}</button>)}</nav>
  {tab === "agent" ? <>
   <section className="intro"><div className="eyebrow"><span />MULTI-MODEL WORKSPACE</div><h1>Ваша ідея.<br /><span>Його наступний крок.</span></h1><p>Код, автоматизація та дизайн — у вашому ритмі.</p><div className="mode-pill"><i />{health ? health.executionEnabled ? "Виконання змін увімкнено" : "Режим підготовки змін" : "Конфігурація ще не перевірена"}</div></section>
   <section className="models" aria-label="Вибір AI-провайдера"><div className="section-heading"><h2>Оберіть інтелект</h2><span>{health ? `${available.length} налаштовано` : "Перевіряємо стан"}</span></div><div className="model-grid">{providers.map(item => <button key={item.id} className={`model-card ${provider === item.id ? "selected" : ""}`} onClick={() => setProvider(item.id)} aria-pressed={provider === item.id} disabled={busy}><span className="model-mark" aria-hidden="true">{item.mark}</span><span className="model-name">{item.name}</span><small>{item.note}</small><span className={`model-state ${available.includes(item.id) ? "configured" : ""}`}>{health ? available.includes(item.id) ? "Налаштовано" : "Потрібен ключ" : "Стан невідомий"}</span>{provider === item.id ? <span className="model-check" aria-hidden="true">✓</span> : null}</button>)}</div><p className="fineprint">Фактичну модель задають налаштування сервера. Її назва, токени та вартість тут поки недоступні.</p></section>
   <section className="workspace" aria-label="Розмова з агентом"><div className="section-heading"><h2>Ваш агент <span className="heading-tag">ARTSS AI</span></h2><button className="text-button" disabled={busy || messages.length === 0} onClick={() => { setMessages([]); setNotice("Почато нову розмову. Історія запусків цієї сесії збережена."); }}>Нова розмова +</button></div>
    {messages.length === 0 ? <div className="welcome"><div className="agent-symbol" aria-hidden="true">✦</div><div><h3>З чого почнемо?</h3><p>Опишіть задачу або оберіть швидкий старт.</p></div><div className="prompt-grid">{prompts.map(prompt => <button key={prompt.title} onClick={() => choosePrompt(prompt.text)}><span aria-hidden="true">{prompt.icon}</span>{prompt.title}<b aria-hidden="true">↗</b></button>)}</div></div> : <div className="messages" role="log" aria-live="polite">{messages.map((message, index) => <article key={index} className={`msg ${message.role === "user" ? "user" : ""}`}><div className="label">{message.role === "user" ? "ВИ" : "ARTSS"}<span>{message.meta}</span></div><div className="bubble">{message.content}</div></article>)}{busy ? <div className="thinking" role="status"><span />Агент обробляє задачу…</div> : null}<div ref={endRef} /></div>}
    {healthError ? <p className="alert" role="alert">{healthError} <button onClick={() => { setChecking(true); void refreshHealth(); }} disabled={checking}>Повторити</button></p> : null}
    {health && available.length === 0 ? <p className="alert">Додайте ключ хоча б одного AI-провайдера в налаштуваннях сервера, щоб запустити агента.</p> : null}
    {health && available.length > 0 && !available.includes(provider) ? <p className="alert">Обраний провайдер не налаштований. Сервер використає доступного провайдера.</p> : null}
    <form className="composer" onSubmit={send}><label className="sr-only" htmlFor="agent-task">Задача для агента</label><textarea id="agent-task" ref={inputRef} value={input} onChange={event => setInput(event.target.value)} placeholder="Що створимо сьогодні?" rows={2} disabled={busy} /><div className="composer-bottom"><span><i />{providers.find(item => item.id === provider)?.name}</span><button className="send" disabled={busy || !input.trim() || (health !== null && available.length === 0)} aria-label="Надіслати задачу">{busy ? "Обробка…" : "Запустити"}<b aria-hidden="true">↗</b></button></div></form>
   </section>
  </> : tab === "runs" ? <section className="section-page"><div className="eyebrow">ACTIVITY</div><h1>Від ідеї до результату.</h1><p className="muted">Запуски в поточній сесії браузера. Після перезавантаження список очищується.</p><div className="run-summary"><div><strong>{runs.length}</strong><span>Запитів у сесії</span></div><div><strong>{runs.filter(run => run.status === "done").length}</strong><span>Завершено</span></div><div><strong>{runs.filter(run => run.status === "error").length}</strong><span>З помилкою</span></div></div>{runs.length === 0 ? <div className="blank-state"><span>↗</span><h2>Перший запуск попереду</h2><p>Поставте задачу агенту — тут з’явиться її фактичний результат.</p><button className="primary-button" onClick={() => setTab("agent")}>До агента ↗</button></div> : <div className="run-list">{runs.map(run => <article key={run.id} className="run-card"><span className={`run-icon ${run.status}`}>{run.status === "done" ? "✓" : run.status === "error" ? "!" : "↗"}</span><div><h2>{run.task}</h2><p>{run.provider} · {new Date(run.id).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })}{run.seconds !== undefined ? ` · ${run.seconds.toFixed(1)} с` : ""}</p></div><span className="run-state">{run.status === "done" ? "Готово" : run.status === "error" ? "Помилка" : "Працює"}</span></article>)}</div>}<p className="fineprint">Час — тривалість запиту в браузері. Оцінка якості, токени, вартість і події fallback наразі не надходять від API.</p></section> : <section className="section-page"><div className="eyebrow">CONNECTED WORKSPACE</div><h1>Ваші інструменти.<br /><span>Один простір.</span></h1><p className="muted">Ваш набір сервісів для розробки та творчості.</p><div className="section-heading"><h2>Інтеграції</h2><button className="text-button" onClick={() => { setChecking(true); void refreshHealth(); }} disabled={checking}>{checking ? "Перевірка…" : "Оновити стан ↻"}</button></div>{healthError ? <p className="alert" role="alert">{healthError}</p> : null}<div className="integration-grid">{services.map(service => <article key={service.name} className="integration-card"><div className="integration-top"><span className="integration-logo" aria-hidden="true">{service.mark}</span><span className={`connection ${service.configured ? "configured" : ""}`}>{service.planned ? "Планується" : service.configured === undefined ? "Невідомо" : service.configured ? "Налаштовано" : "Не налаштовано"}</span></div><h2>{service.name}</h2><p>{service.detail}</p><button onClick={() => setNotice(service.planned ? `${service.name}: інтеграція з цим застосунком ще не реалізована. Підключення плагіна в ChatGPT не підключає його автоматично до панелі ARTSS.` : `${service.name}: ${service.configured === undefined ? "стан конфігурації недоступний" : service.configured ? "сервер має потрібні налаштування; доступ до сервісу ще не перевірено" : "додайте потрібні серверні змінні через налаштування хостингу"}. Секрети не вводяться в цій панелі.`)}>Деталі <span aria-hidden="true">↗</span></button></article>)}</div><p className="fineprint">«Налаштовано» означає наявність серверних змінних, а не успішну перевірку API чи прав доступу.</p></section>}
  {notice ? <div className="notice" role="status"><p>{notice}</p><button onClick={() => setNotice("")} aria-label="Закрити повідомлення">×</button></div> : null}
  <footer className="footer"><span>ARTSS / ваш творчий контроль</span><span>Розробка · AI · Автоматизація</span></footer>
 </main>;
}
