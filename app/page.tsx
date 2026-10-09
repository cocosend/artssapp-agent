"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AgentComposer, type ComposerHandle } from "./agent-composer";
import { ArtssMark } from "./artss-mark";
import Image from "next/image";
import { type ChangeEvent } from "react";
import { StudioSettingsPanel, DEFAULT_SETTINGS, sanitizeSettings, type StudioSettings } from "./studio-settings";
import { StudioSidebar, type StudioSection } from "./studio-sidebar";
import { CodeWorkspace } from "./code-workspace";
import { MultiAgentBoard, type TeamLastRun, type TeamMode, type AgentRunReport } from "./multi-agent-board";
import { beginRunClock, elapsedRunSeconds } from "./run-clock";

type Provider = "openai" | "deepseek" | "gemini" | "claude" | "mistral";
type Mode = Provider | "multi";
type Message = { role: "user" | "assistant"; content: string; meta?: string; imageUrl?: string; sources?: { url: string; title: string }[] };
type Run = { id: number; title: string; model: string; status: "running" | "done" | "error" | "skipped"; seconds?: number; note?: string; prUrl?: string; deploymentUrl?: string };
type Health = {
  ok: boolean;
  providers: { configured: Provider[] };
  integrations: { github: boolean; vercel: boolean; supabase: boolean };
  executionEnabled: boolean;
};
type AgentReply = { text?: string; error?: string; provider?: string; contributors?: string[]; action?: string; prUrl?: string; deploymentUrl?: string; image?: string; size?: string; quality?: string; sources?: { title: string; url: string }[]; orchestration?: AgentRunReport };
type ProbeStatus = { state: "ok" | "missing_key" | "http_error" | "timeout"; status?: number; via?: "direct" | "gateway" };
type Diagnostics = { checkedAt: string; results: Record<string, ProbeStatus>; githubRead: boolean; githubWrite: string; agentExecution: string; vercelDeploy: string };
const diagLabels: Record<string, string> = {
  openai: "OpenAI", deepseek: "DeepSeek", gemini: "Gemini",
  claude: "Claude", mistral: "Mistral", github: "GitHub",
  supabase: "Supabase", vercel: "Vercel",
};
const diagStatus = (value: ProbeStatus) => value.state === "ok" ? "API відповідає" :
  value.state === "missing_key" ? "Потрібен ключ" : value.state === "timeout" ? "Немає відповіді" :
  "API помилка" + (value.status ? " (" + value.status + ")" : "");

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
  const [preferences, setPreferences] = useState<StudioSettings>(DEFAULT_SETTINGS);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeSection, setActiveSection] = useState<StudioSection>("home");
  const [openedImage, setOpenedImage] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [storedRuns, setStoredRuns] = useState<Run[]>([]);
  const [busy, setBusy] = useState(false);
  const [workingMode, setWorkingMode] = useState<TeamMode | null>(null);
  const [lastTeam, setLastTeam] = useState<TeamLastRun | null>(null);
  const [notice, setNotice] = useState("");
  const [showAllModels, setShowAllModels] = useState(false);
  const [showAllRuns, setShowAllRuns] = useState(false);
  const [toolMode, setToolMode] = useState<"agent" | "image" | "web">("agent");
  const [menu, setMenu] = useState<"notifications" | "profile" | null>(null);
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [diagnosticsBusy, setDiagnosticsBusy] = useState(false);
  const [diagnosticsError, setDiagnosticsError] = useState("");
  const composerRef = useRef<ComposerHandle>(null);
  const modelRef = useRef<HTMLDivElement>(null);
  const shortcutRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const servicesRef = useRef<HTMLElement>(null);
  const inFlightHealth = useRef(false);
  const requestController = useRef<AbortController | null>(null);
  const inFlightPrompt = useRef<string | null>(null);
  const activeRunId = useRef<number | null>(null);
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
    const task = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem("artss-studio-settings-v1");
        if (stored) {
          const next = sanitizeSettings(JSON.parse(stored));
          setPreferences(next);
          setSelected(next.model);
        }
      } catch { /* Invalid or inaccessible preference storage. */ }
      setPreferencesLoaded(true);
    }, 0);
    return () => window.clearTimeout(task);
  }, []);

  useEffect(() => {
    if (!preferencesLoaded) return;
    try { window.localStorage.setItem("artss-studio-settings-v1", JSON.stringify(preferences)); }
    catch { /* localStorage may be disabled. */ }
  }, [preferences, preferencesLoaded]);

  useEffect(() => {
    if (!openedImage) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpenedImage(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openedImage]);

  function chooseModel(model: Mode) {
    setSelected(model);
    setPreferences(previous => ({ ...previous, model }));
  }
  function setStudioSettings(next: StudioSettings) {
    setPreferences(next);
    setSelected(next.model);
  }
  function newChat() {
    if (busy) return;
    setMessages([]);
    setToolMode("agent");
    composerRef.current?.fill("");
  }
  async function saveImage(data: string) {
    try {
      if (!data.startsWith("data:image/png;base64,") || data.length > 20_000_000) {
        throw new Error("Invalid or oversized image data.");
      }
      const binary = window.atob(data.slice("data:image/png;base64,".length));
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const file = new File([bytes], "ARTSS-AI-image.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({ files: [file], title: "ARTSS AI — зображення" });
        return;
      }
      const href = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = href;
      link.download = file.name;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(href), 1500);
      setNotice("Зображення передано для збереження.");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setNotice("Збереження недоступне в цьому браузері.");
    }
  }

  useEffect(() => {
    const immediate = window.setTimeout(() => { void refresh(); }, 0);
    const interval = window.setInterval(() => { if (!document.hidden) void refresh(); }, 90_000);
    return () => { window.clearTimeout(immediate); window.clearInterval(interval); };
  }, [refresh]);

  useEffect(() => {
    if (messages.length) threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "auto" });
  }, [messages]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/auth/session", { cache: "no-store", signal: controller.signal })
      .then(response => { if (response.status === 401 && !controller.signal.aborted) router.replace("/login"); })
      .catch(() => { /* No false redirects on network interruptions. */ });
    return () => controller.abort();
  }, [router]);

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
    if (id !== "chat") {
      const fold = document.getElementById("fold-" + id) as HTMLDetailsElement | null;
      if (fold) fold.open = true;
    }
    window.setTimeout(() => {
      const target = id === "models" ? document.getElementById("fold-models") :
        id === "integrations" ? document.getElementById("fold-integrations") :
        document.getElementById("agent-composer");
      target?.scrollIntoView({ behavior: "auto", block: "start" });
    }, 0);
  }

  function goToSection(section: StudioSection) {
    setSidebarOpen(false);
    if (section === "code") { setActiveSection("code"); return; }
    if (section === "team") { setToolMode("agent"); chooseModel("multi"); }
    setActiveSection(section);
    if (section === "models" || section === "integrations" || section === "runs") {
      const fold = document.getElementById("fold-" + section) as HTMLDetailsElement | null;
      if (fold) fold.open = true;
    }
    if (section === "web") setToolMode("web");
    if (section === "images") setToolMode("image");
    window.setTimeout(() => {
      const target = section === "home" ? null :
        section === "team" ? document.getElementById("team-status") :
        section === "models" ? modelRef.current :
        section === "integrations" ? servicesRef.current :
        section === "runs" ? document.getElementById("runs-title") :
        document.getElementById("agent-composer");
      if (!target) { window.scrollTo({ top: 0, behavior: "auto" }); return; }
      target.scrollIntoView({ block: "center", behavior: "auto" });
      if (section === "web" || section === "images") composerRef.current?.focus();
    }, 0);
  }

  function sendEditorDraft(text: string) {
    setActiveSection("home");
    setToolMode("agent");
    setSidebarOpen(false);
    window.setTimeout(() => {
      composerRef.current?.fill(text);
      document.getElementById("agent-composer")?.scrollIntoView({ block: "center", behavior: "auto" });
      setNotice("Код додано до запиту. Перевірте текст та натисніть Надіслати.");
    }, 0);
  }

  function skipRequest() {
    if (!requestController.current) return;
    requestController.current.abort();
    if (inFlightPrompt.current) composerRef.current?.restoreIfEmpty(inFlightPrompt.current);
    inFlightPrompt.current = null;
    requestController.current = null;
    const id = activeRunId.current;
    activeRunId.current = null;
    if (id !== null) setRuns(prev => prev.map(r => r.id === id ? { ...r, status: "skipped", note: "Зупинено в інтерфейсі" } : r));
    setBusy(false);
    setWorkingMode(null);
    setNotice("Запит пропущено. Уже розпочаті серверні дії можуть завершитися.");
  }

  async function submit(text: string) {
    const task = text.trim();
    if (!task || busy || (toolMode === "agent" && health && !ready)) return;
    const { started, id } = beginRunClock();
    const controller = new AbortController();
    requestController.current = controller;
    inFlightPrompt.current = task;
    activeRunId.current = id;
    const conversation: Message[] = [...messages.slice(-18), { role: "user", content: task }];
    setMessages(conversation);
    const modeForRequest = toolMode;
    const runModel = modeForRequest === "image" ? "Генерація зображення" : modeForRequest === "web" ? "Веб-пошук" : selected;
    setRuns(previous => [{ id, title: task, model: runModel, status: "running" as const }, ...previous].slice(0, 40));
    setBusy(true);
    setWorkingMode(modeForRequest === "agent" ? selected : null);
    setNotice("");
    try {
      const endpoint = modeForRequest === "image" ? "/api/images" : modeForRequest === "web" ? "/api/web-search" : "/api/agent";
      const payload = modeForRequest === "image" ? { prompt: task, aspect: preferences.imageAspect, quality: preferences.imageQuality } : modeForRequest === "web" ? { question: task } :
        { provider: selected, messages: conversation.map(({ role, content }) => ({ role, content })) };
      const response = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const result: AgentReply = await response.json().catch(() => ({}));
      if (controller.signal.aborted) return;
      if (response.status === 401) {
        inFlightPrompt.current = null;
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
      setMessages(previous => {
        // On older iPhones, only retain the latest three full-size base64 images in memory.
        let imageCount = 0;
        const kept = [...previous.slice(-29)].reverse().map(item => {
          if (!item.imageUrl) return item;
          imageCount += 1;
          return imageCount <= 2 ? item : { ...item, imageUrl: undefined, meta: "Зображення звільнено з пам'яті" };
        }).reverse();
        return [...kept, {
          role: "assistant" as const,
          content: modeForRequest === "image" ? "Згенероване зображення: " + task : result.text || "Агент не повернув текст.",
          meta: modeForRequest === "image" ? description + " · " + (result.size || preferences.imageAspect) + " · " + (result.quality || preferences.imageQuality) : description,
          imageUrl: modeForRequest === "image" ? result.image : undefined,
          sources: modeForRequest === "web" && Array.isArray(result.sources) ? result.sources.filter(x => typeof x?.url === "string" && x.url.startsWith("https://")).slice(0, 8) : undefined,
        }];
      });
      if (requestController.current === controller) inFlightPrompt.current = null;
      if (modeForRequest === "agent" && result.orchestration) {
        setLastTeam({
          task, mode: selected, provider: result.provider || selected,
          duration: (performance.now() - started) / 1000, report: result.orchestration,
        });
      }
      setRuns(previous => previous.map(run => run.id === id ? {
        ...run, status: "done", model, seconds: (performance.now() - started) / 1000,
        prUrl: result.prUrl, deploymentUrl: result.deploymentUrl, note: description,
      } : run));
    } catch (error) {
      if (controller.signal.aborted) return;
      const description = error instanceof Error ? error.message : "Невідома помилка.";
      composerRef.current?.restoreIfEmpty(task);
      setMessages(previous => [...previous.slice(-39), { role: "assistant", content: description, meta: "Помилка" }]);
      setRuns(previous => previous.map(run => run.id === id ? { ...run, status: "error", seconds: (performance.now() - started) / 1000, note: description } : run));
    } finally {
      if (requestController.current === controller) {
        requestController.current = null;
        activeRunId.current = null;
        inFlightPrompt.current = null;
        setBusy(false);
        setWorkingMode(null);
      }
    }
  }

  function move(ref: { current: HTMLDivElement | null }, step: number) {
    ref.current?.scrollBy({ left: step * 260, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  async function logout() {
    try { await fetch("/api/auth/logout", { method: "POST" }); }
    finally { router.push("/login"); router.refresh(); }
  }

  async function checkIntegrations() {
    if (diagnosticsBusy) return;
    setDiagnosticsBusy(true);
    setDiagnosticsError("");
    try {
      const response = await fetch("/api/diagnostics", { cache: "no-store" });
      if (response.status === 401) { router.push("/login"); return; }
      if (!response.ok) throw new Error("Не вдалося перевірити підключення.");
      const result: Diagnostics = await response.json();
      if (!result.results) throw new Error("Сервер повернув некоректні дані.");
      setDiagnostics(result);
    } catch (error) {
      setDiagnosticsError(error instanceof Error ? error.message : "Перевірка недоступна.");
    } finally {
      setDiagnosticsBusy(false);
    }
  }

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setNotice("Відповідь скопійовано."); }
    catch { setNotice("Копіювання недоступне у цьому браузері."); }
  }

  return <div className={"pm-shell neo-app flagship-app studio-layout night-shell" + (sidebarCollapsed ? " night-sidebar-hidden" : "")} data-density={preferences.density} data-effects={preferences.effects ? "on" : "off"} data-motion={preferences.motion} data-textsize={preferences.textSize}>
    <StudioSidebar open={sidebarOpen} active={activeSection} busy={busy} onClose={() => setSidebarOpen(false)}
      onNavigate={goToSection} onSettings={() => { setSidebarOpen(false); setSettingsOpen(true); }}
      onNewChat={() => { setSidebarOpen(false); newChat(); goToSection("home"); }} onCollapse={() => setSidebarCollapsed(true)}/>
    <div className="studio-workarea">
    <header className="pm-header neo-header">
      <button type="button" className="studio-mobile-trigger" aria-controls="studio-nav" aria-expanded={sidebarOpen}
        aria-label={sidebarOpen ? "Закрити бічне меню" : "Відкрити бічне меню"} onClick={() => { if (window.matchMedia("(min-width: 981px)").matches) setSidebarCollapsed(x => !x); else setSidebarOpen(x => !x); }}>☰</button>
      <Link className="pm-brand" href="/" aria-label="ARTSS AI — головна">
        <span className="pm-brand-mark flagship-logo"><ArtssMark size={48}/></span>
        <span className="pm-brand-label">ARTSS<span className="pm-dot">●</span>AI<small>MULTI-AGENT STUDIO</small></span>
      </Link>
      <div className="pm-header-right">
        <span className={"pm-live " + (health ? "up" : "")} title={health ? "API відповідає" : "API не перевірено"}><i /><span className="neo-status-caption">{loading ? "Перевірка" : health ? "API онлайн" : "Офлайн"}</span></span>
        <button type="button" className={"pm-round-icon flagship-alert-button" + (menu === "notifications" ? " selected" : "")} onClick={() => setMenu(x => x === "notifications" ? null : "notifications")} aria-expanded={menu === "notifications"} aria-label="Сповіщення та запуски">♧{recentRuns.some(r => r.status === "running") ? <span className="flagship-alert-dot"/> : null}</button>
        <button type="button" className={"pm-round-icon flagship-profile-button" + (menu === "profile" ? " selected" : "")} onClick={() => setMenu(x => x === "profile" ? null : "profile")} aria-expanded={menu === "profile"} aria-label="Профіль та вихід">♙</button>
        {menu ? <div className="flagship-header-menu" role="region" aria-label={menu === "profile" ? "Профіль" : "Сповіщення"}>
          {menu === "profile" ? <><strong>Приватний простір ARTSS AI</strong><p>Доступ до AI, інтеграцій та робочих сценаріїв.</p>
          <button type="button" onClick={() => { setMenu(null); setSettingsOpen(true); }}>⚙ Налаштування інтерфейсу</button>
          <button type="button" onClick={() => { setMenu(null); setLoading(true); void refresh(); }}><Icon name="refresh" size={16}/> Оновити стан</button>
          <button type="button" onClick={() => { void logout(); }}><Icon name="logout" size={16}/> Вийти</button></> :
          <><strong>Запуски та сповіщення</strong>{recentRuns.length ? recentRuns.slice(0,4).map(run =>
            <p key={run.id} className="flagship-menu-run"><span>{run.status === "done" ? "✓" : run.status === "error" ? "!" : "◷"}</span>{run.title.slice(0,78)}</p>) :
            <p>Нових запусків немає. Завдання з&apos;являться після запиту.</p>}
          <button type="button" onClick={() => { setMenu(null); document.getElementById("runs-title")?.scrollIntoView({ block: "center", behavior: "smooth" }); }}>Переглянути запуски <Icon name="chevron" size={16}/></button></>}
        </div> : null}
      </div>
    </header>
    <main className="pm-main neo-main">
      {activeSection === "code" ?
        <CodeWorkspace onSendToAgent={sendEditorDraft} onClose={() => goToSection("home")}
          githubWrite={Boolean(health?.integrations.github && health?.executionEnabled)}/> :
      <>
      <section className="night-intro" aria-labelledby="neo-title">
        <div><span className="night-kicker">ARTSS AI / AGENT WORKSPACE</span><h1 id="neo-title">Працюйте з командою AI<span> ✦</span></h1><p>Одна задача. Кілька моделей. Перевірений спільний результат.</p></div>
        <span className={"night-system-indicator" + (health?.ok ? " online" : "")}><i/>{loading ? "Перевірка" : health?.ok ? "Система активна" : "Немає зв'язку"}</span>
      </section>

      <details className="night-fold" id="fold-models">
        <summary className="night-fold-summary"><span className="night-fold-number">01</span><strong>Моделі AI</strong><small>Вибір та маршрутизація</small><span className="night-fold-chevron" aria-hidden="true">⌄</span></summary>
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
              onClick={() => chooseModel(m.id)}>
              <span className="neo-model-symbol">{m.symbol}</span>
              <span className={"neo-model-indicator" + (active ? " on" : "")} title={active ? "Ключ налаштовано" : "Потрібен ключ"}/>
              <strong>{m.title}</strong><small>{m.subtitle}</small>
              <span className="neo-model-status">{loading ? "Перевірка" : active ? "Доступний ключ" : "Немає ключа"}</span>
            </button>;
          })}
        </div>
        {!ready && health ? <p className="neo-inline-alert">Для вибраної моделі немає ключа. Оберіть активну модель.</p> : null}
      </section>
      </details>

      <details className="night-fold" id="fold-tasks">
        <summary className="night-fold-summary"><span className="night-fold-number">02</span><strong>Швидкі дії</strong><small>Шаблони та сценарії</small><span className="night-fold-chevron" aria-hidden="true">⌄</span></summary>
      <section className="pm-panel neo-section" aria-labelledby="tasks-title">
        <div className="neo-section-head"><h2 id="tasks-title"><span className="neo-heading-symbol sun">ϟ</span> ШВИДКІ ДІЇ</h2></div>
        <div className="pm-carousel neo-action-strip" ref={shortcutRef}>
          <button className="neo-action" type="button" onClick={() => { newChat(); jumpTo("chat"); }}>
            <span className="neo-action-symbol">▤</span><strong>Новий запит</strong><small>Текст, код, аналіз</small><Icon name="chevron" size={15}/>
          </button>
          <button className="neo-action neo-action-image" type="button" onClick={() => { setTool("image"); jumpTo("chat"); }}><span className="neo-action-symbol">▧</span><strong>Генерувати зображення</strong><small>OpenAI Images</small><Icon name="chevron" size={15}/></button>
          {shortcuts.slice(0,2).map(x => <button type="button" className={"neo-action neo-action-" + x.id} key={x.id} onClick={() => { chooseTask(x.value); jumpTo("chat"); }}>
            <span className="neo-action-symbol">{x.symbol}</span><strong>{x.title === "План" ? "Агент-режим" : x.title === "Код" ? "Робота з кодом" : "Аудит системи"}</strong><small>{x.caption}</small><Icon name="chevron" size={15}/>
          </button>)}
        </div>
      </section>
      </details>

      <details className="night-fold" id="fold-integrations">
        <summary className="night-fold-summary"><span className="night-fold-number">03</span><strong>Інтеграції</strong><small>GitHub · Vercel · Supabase</small><span className="night-fold-chevron" aria-hidden="true">⌄</span></summary>
      <section className="pm-panel neo-section" aria-labelledby="integrations-title" ref={servicesRef}>
        <div className="neo-section-head"><h2 id="integrations-title"><span className="neo-heading-symbol gold">♧</span> ІНТЕГРАЦІЇ ТА СТАТУС</h2><button className="neo-show-more" type="button" onClick={() => { setLoading(true); void refresh(); }}>Оновити <Icon name="refresh" size={14}/></button></div>
        <div className="neo-service-strip">
          {integrations.map(s => <a className="neo-service-card" href={s.href} key={s.key} target="_blank" rel="noreferrer">
            <span className={"neo-service-logo neo-service-" + s.key}>{s.mark}</span>
            <span className="neo-service-text"><strong>{s.title}</strong><small>{loading ? "Перевірка" : health?.integrations[s.key] ? "Ключ налаштовано" : "Не налаштовано"}</small></span>
            <i className={"neo-service-dot" + (health?.integrations[s.key] ? " active" : "")} aria-hidden="true"/>
          </a>)}
        </div>
        <p className="neo-small-note">Статус у картках показує наявність ключа, а не успіх запиту. Режим запису в GitHub: {health?.executionEnabled ? "дозволений" : "вимкнений"}.</p>
        <button className="diagnostic-button" type="button" onClick={() => { void checkIntegrations(); }} disabled={diagnosticsBusy}>
          <Icon name="refresh" size={16}/> {diagnosticsBusy ? "Перевіряю 8 підключень…" : "Перевірити реальні підключення"}
        </button>
        {diagnosticsError ? <p className="diagnostic-error" role="alert">{diagnosticsError}</p> : null}
        {diagnostics ? <div className="diagnostic-panel" aria-label="Результати перевірки">
          <p className="diagnostic-caption">Перевірено {new Date(diagnostics.checkedAt).toLocaleTimeString("uk-UA", {hour:"2-digit",minute:"2-digit"})} · Без запуску платних моделей</p>
          <div className="diagnostic-grid">{Object.entries(diagLabels).map(([key, label]) => {
            const result = diagnostics.results[key];
            return <div className="diagnostic-row" key={key}>
              <strong>{label}</strong>
              <span className={result?.state === "ok" ? "good" : "notready"}>
                <i/>{result ? diagStatus(result) + (result.via === "gateway" && result.state === "ok" ? " · Gateway" : "") : "Не перевірено"}
              </span>
            </div>;
          })}</div>
          <p className="diagnostic-caption">Читання GitHub: {diagnostics.githubRead ? "працює" : "недоступне"}. Запис у GitHub: {diagnostics.githubWrite === "missing_key" ? "немає токена" : diagnostics.githubWrite === "token_present_not_write_tested" ? "токен є, запис не тестувався" : "недоступний"}. Автоматичне виконання: {diagnostics.agentExecution === "disabled" ? "вимкнене" : "налаштоване, не тестувалося"}.</p>
        </div> : null}
      </section>
      </details>

      <details className="night-fold" id="fold-runs">
        <summary className="night-fold-summary"><span className="night-fold-number">04</span><strong>Запуски</strong><small>Історія задач</small><span className="night-fold-chevron" aria-hidden="true">⌄</span></summary>
      <section className="pm-panel neo-section" aria-labelledby="runs-title">
        <div className="neo-section-head">
          <h2 id="runs-title"><span className="neo-heading-symbol gold">◷</span> НЕДАВНІ ЗАПУСКИ</h2>
          <button type="button" className="neo-show-more" onClick={() => setShowAllRuns(x => !x)} aria-expanded={showAllRuns}>{showAllRuns ? "Згорнути" : "Усі запуски"} <Icon name="chevron" size={15}/></button>
        </div>
        <div className="neo-runs">
          {!recentRuns.length ? <div className="neo-no-runs"><span>◎</span><div><strong>Поки що немає запусків</strong><p>Результати реальних задач з&apos;являться тут після першого запиту.</p></div></div> :
            recentRuns.slice(0,showAllRuns ? 40 : 3).map(r => <div className="neo-run-row" key={r.id}>
              <span className={"neo-run-logo " + r.status}>{r.status === "done" ? "✓" : r.status === "error" ? "!" : r.status === "skipped" ? "⏭" : "⌘"}</span>
              <span className="neo-run-info"><strong>{r.title}</strong><small>{r.model} · {r.id > 0 ? displayTime(r.id) : "—"} {r.seconds ? "· " + r.seconds.toFixed(1) + " c" : ""}</small>{r.prUrl?.startsWith("https://github.com/") ? <a href={r.prUrl} target="_blank" rel="noreferrer">Відкрити PR ↗</a> : null}</span>
              <span className={"neo-run-pill " + r.status}>{r.status === "done" ? "✓ Готово" : r.status === "error" ? "Помилка" : r.status === "skipped" ? "Пропущено" : "Виконується"}</span>
            </div>)}
        </div>
      </section>
      </details>

      <div className="multi-workbench">
      <section className="neo-chat-section" id="agent-composer" aria-label="AI-чат">
        <div className="multi-chat-heading">
          <div><span>СТУДІЯ ARTSS</span><h2>{toolMode === "agent" ? selected === "multi" ? "Multi-agent чат" : "Чат із " + (models.find(m => m.id === selected)?.title || selected) : toolMode === "web" ? "Інтернет-дослідження" : "Генерація зображень"}</h2></div>
          <button type="button" onClick={() => goToSection("team")} aria-label="Показати команду агентів">Команда <span aria-hidden="true">↗</span></button>
        </div>
        {messages.length ? <div className="pm-thread neo-thread" ref={threadRef} role="log" aria-live="polite">
          {messages.map((message, index) => <article className={"pm-message " + message.role} key={index}>
            <span className="pm-message-label">{message.role === "user" ? "ВИ" : "ARTSS AI"} <small>{message.meta || ""}</small></span>
            <div className="pm-bubble">{message.content}{message.imageUrl ? <div className="image-result"><Image className="flagship-generated-image" src={message.imageUrl} alt="Зображення, створене агентом" width={1024} height={1024} unoptimized/><div className="image-result-actions"><button type="button" onClick={() => setOpenedImage(message.imageUrl!)}>Переглянути</button><button type="button" onClick={() => { void saveImage(message.imageUrl!); }}>Зберегти / Поділитися</button></div></div> : null}</div>
            {message.sources?.length ? <div className="web-source-list">{message.sources.map((src,i) => <a key={i} href={src.url} rel="noopener noreferrer" target="_blank">↗ {src.title || "Джерело " + (i+1)}</a>)}</div> : null}
            {message.role === "assistant" ? <button type="button" className="pm-copy" onClick={() => { void copy(message.content); }}><Icon name="copy" size={14}/> Копіювати</button> : null}
          </article>)}</div> : null}
        {busy ? <div className="engine-running"><p className="pm-thinking" role="status"><span className="pm-pulse"/>Агент обробляє запит…</p>
          <button type="button" className="skip-request" onClick={skipRequest} aria-label="Пропустити поточний запит">⏭ Скип / Зупинити</button>
          <p className="engine-state-label">Скип зупинить очікування в застосунку. Якщо сервер уже почав запис або деплой, операція може завершитися.</p></div> : null}
        {toolMode === "web" ? <div className="web-current-options" role="status">◎ Інтернет-пошук через OpenAI. Результати показують посилання на використані джерела.</div> : null}
        {toolMode === "image" ? <div className="image-current-options" aria-live="polite"><span>Зображення · {preferences.imageAspect === "square" ? "1:1" : preferences.imageAspect === "landscape" ? "3:2" : "2:3"} · {preferences.imageQuality === "low" ? "швидка" : preferences.imageQuality === "medium" ? "збалансована" : "детальна"}</span><button type="button" onClick={() => setSettingsOpen(true)}>Змінити параметри</button></div> : null}
        <AgentComposer ref={composerRef} model={toolMode === "image" ? "Генерація зображень" : toolMode === "web" ? "Веб-пошук" : models.find(x=>x.id===selected)?.title || selected} busy={busy} unavailable={toolMode === "agent" && health !== null && !ready} onSend={submit}/>
        <div className="neo-composer-tools">
          <button type="button" className={toolMode === "agent" ? "tool-active" : ""} onClick={() => { setTool("agent"); chooseModel("multi"); }}>✦ Multi AI</button>
          <button type="button" className={toolMode === "web" ? "tool-active" : ""} onClick={() => setTool("web")}>◎ Веб-пошук</button>
          <label className="flagship-file-trigger">▤ Файли<input type="file" accept=".txt,.md,.json,.ts,.tsx,.js,.jsx,.css,.html,.yaml,.yml,.sql,.log,.py,.go,.rs,text/*" onChange={e => { void attachFile(e); }}/></label>
          <button type="button" className={toolMode === "image" ? "tool-active" : ""} onClick={() => setTool("image")}>▧ Зображення</button>
          <button type="button" onClick={() => goToSection("code")}>〈/〉 Код</button>
          <button type="button" onClick={() => { chooseTask(shortcuts[2].value); }}>⊞ Аудит</button>
          <button type="button" onClick={() => { chooseTask(shortcuts[0].value); }}>✧ План</button>
        </div>
        {healthError ? <div className="pm-notice-error" role="alert">{healthError}<button type="button" onClick={() => { void refresh(); }}>Повторити</button></div> : null}
        {!loading && health && !configured.length ? <div className="pm-notice-error">Жоден AI-провайдер не має налаштованого ключа.</div> : null}
      </section>
      <MultiAgentBoard configured={configured} selected={selected} working={busy && toolMode === "agent"}
        workingMode={workingMode} last={lastTeam}
        onSelect={mode => { chooseModel(mode); setToolMode("agent"); }}
        onCompose={() => { setActiveSection("home"); window.setTimeout(() => composerRef.current?.focus(), 0); }}
        onStop={skipRequest} onNewChat={() => { newChat(); setActiveSection("home"); }}/>
      </div>

      </>}
      {notice ? <div className="pm-toast" role="status"><Icon name="check" size={16}/><span>{notice}</span><button type="button" onClick={() => setNotice("")} aria-label="Закрити">×</button></div> : null}
      <footer className="pm-footer"><span>ARTSS AI <span className="pm-dot">●</span> PRIVATE AGENT STUDIO</span><span>Зв&apos;язок перевірено: {lastCheck || "—"}</span></footer>
    </main>
    </div>
    <StudioSettingsPanel open={settingsOpen} value={preferences} onChange={setStudioSettings} onClose={() => setSettingsOpen(false)}
      onNewChat={newChat} onRefresh={() => { setLoading(true); void refresh(); }} busy={busy}/>
    {openedImage ? <div className="image-lightbox" role="presentation" onClick={e => { if (e.currentTarget === e.target) setOpenedImage(null); }}>
      <div role="dialog" aria-modal="true" aria-label="Попередній перегляд зображення" className="image-lightbox-content">
        <div className="image-lightbox-toolbar"><strong>ARTSS AI · Зображення</strong><button type="button" onClick={() => setOpenedImage(null)}>Закрити ×</button></div>
        <Image alt="Попередній перегляд створеного зображення" src={openedImage} width={1024} height={1024} unoptimized/>
        <button type="button" className="image-lightbox-save" onClick={() => { void saveImage(openedImage); }}>Зберегти / Поділитися</button>
      </div>
    </div> : null}
  </div>;
}
