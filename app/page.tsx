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
import { OnlinePainter } from "./online-painter";
import { decodeLocalChat, encodeLocalChat } from "@/lib/local-chat";
import { beginRunClock, elapsedRunSeconds } from "./run-clock";
import { mergeRunHistory } from "@/lib/run-history";
import { makeChatTranscript } from "@/lib/chat-transcript";

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
  const [sessionReady, setSessionReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
  const recentRuns = mergeRunHistory(runs, storedRuns);
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
    if (!preferencesLoaded || !sessionReady) return;
    try {
      if (preferences.rememberChat) {
        if (messages.length) window.sessionStorage.setItem("artss-chat-session-v1", encodeLocalChat(messages));
        else window.sessionStorage.removeItem("artss-chat-session-v1");
      } else {
        window.sessionStorage.removeItem("artss-chat-session-v1");
      }
    } catch { /* Browser storage is optional and may be disabled. */ }
  }, [messages, preferences.rememberChat, preferencesLoaded, sessionReady]);

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
    setLastTeam(null);
    try { window.sessionStorage.removeItem("artss-chat-session-v1"); } catch { /* Optional browser storage. */ }
    setToolMode("agent");
    composerRef.current?.fill("");
  }
  async function exportConversation() {
    if (!messages.length) { setNotice("Немає повідомлень для експорту."); return; }
    try {
      const transcript = makeChatTranscript(messages);
      const file = new File([transcript], "ARTSS-AI-conversation.md", { type: "text/markdown" });
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] }) && navigator.share) {
        await navigator.share({ files: [file], title: "ARTSS AI — розмова" });
      } else {
        const url = URL.createObjectURL(file);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = file.name;
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
      }
      setNotice("Експорт готовий.");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setNotice("Не вдалося поділитися розмовою на цьому пристрої.");
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
    if (!preferencesLoaded) return;
    const controller = new AbortController();
    void fetch("/api/auth/session", { cache: "no-store", signal: controller.signal })
      .then(response => {
        if (controller.signal.aborted) return;
        if (response.status === 401) {
          try { window.sessionStorage.removeItem("artss-chat-session-v1"); } catch { /* Optional storage. */ }
          router.replace("/login");
          return;
        }
        if (!response.ok) return;
        if (preferences.rememberChat) {
          try {
            const recovered = decodeLocalChat(window.sessionStorage.getItem("artss-chat-session-v1"));
            if (recovered.length) setMessages(previous => previous.length ? previous : recovered);
          } catch { /* Optional browser storage. */ }
        }
        setSessionReady(true);
      })
      .catch(() => { /* Network failure */ });
    return () => controller.abort();
  }, [router, preferencesLoaded, preferences.rememberChat]);

  async function submitPrompt(promptText: string) {
    if (!promptText.trim() || busy) return;
    setBusy(true);
    setNotice("");
    const runId = Date.now();
    activeRunId.current = runId;
    const clockStart = beginRunClock();

    const userMsg: Message = { role: "user", content: promptText };
    setMessages(prev => [...prev, userMsg]);

    const newRun: Run = { id: runId, title: promptText.slice(0, 48), model: selected, status: "running" };
    setRuns(prev => [newRun, ...prev]);

    try {
      requestController.current = new AbortController();
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptText, model: selected, mode: toolMode }),
        signal: requestController.current.signal,
      });
      const data: AgentReply = await res.json();
      const seconds = elapsedRunSeconds(clockStart);

      if (!res.ok || data.error) {
        throw new Error(data.error || "Помилка виконання агента");
      }

      const assistantMsg: Message = {
        role: "assistant",
        content: data.text || "Виконано успішно.",
        meta: data.provider ? `Модель: ${data.provider}` : undefined,
        imageUrl: data.image,
        sources: data.sources,
      };
      setMessages(prev => [...prev, assistantMsg]);
      setRuns(prev => prev.map(r => r.id === runId ? { ...r, status: "done", seconds, prUrl: data.prUrl, deploymentUrl: data.deploymentUrl } : r));
    } catch (error) {
      const seconds = elapsedRunSeconds(clockStart);
      if (error instanceof Error && error.name === "AbortError") {
        setRuns(prev => prev.map(r => r.id === runId ? { ...r, status: "skipped", seconds, note: "Скасовано" } : r));
        return;
      }
      const message = error instanceof Error ? error.message : "Невідома помилка";
      setMessages(prev => [...prev, { role: "assistant", content: "❌ " + message }]);
      setRuns(prev => prev.map(r => r.id === runId ? { ...r, status: "error", seconds, note: message } : r));
    } finally {
      setBusy(false);
      requestController.current = null;
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col">
      <header className="h-16 px-4 sm:px-6 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200"
          >
            ☰
          </button>
          <div className="flex items-center gap-2.5">
            <ArtssMark size={32} />
            <h1 className="font-bold text-lg tracking-tight bg-gradient-to-r from-indigo-600 to-sky-500 bg-clip-text text-transparent">
              ARTSS AI Studio
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSection("painter")}
            className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-400 rounded-xl text-sm font-medium transition"
          >
            <span>✎</span> Рисовалка
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200"
          >
            ⚙
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <StudioSidebar
          activeSection={activeSection}
          onSelectSection={sec => setActiveSection(sec)}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <main className="flex-1 overflow-y-auto flex flex-col">
          {notice && (
            <div className="m-4 p-3 bg-indigo-600 text-white rounded-2xl text-sm font-medium flex items-center justify-between shadow-md">
              <span>{notice}</span>
              <button type="button" onClick={() => setNotice("")} className="opacity-80 hover:opacity-100 ml-3">✕</button>
            </div>
          )}

          {activeSection === "painter" ? (
            <div className="flex-1 p-6 flex flex-col items-center justify-center">
              <div className="mb-6 text-center">
                <h2 className="text-2xl font-bold tracking-tight mb-1">Онлайн Рисовалка Пензлем</h2>
                <p className="text-sm text-zinc-500">Малюйте пальцем або мишкою, обирайте кольори, розмір та зберігайте шедеври</p>
              </div>
              <OnlinePainter onNotice={setNotice} />
            </div>
          ) : activeSection === "code" ? (
            <div className="flex-1 flex flex-col">
              <CodeWorkspace />
            </div>
          ) : (
            <div className="flex-1 flex flex-col max-w-5xl w-full mx-auto p-4 sm:p-6 gap-6">
              <div className="bg-gradient-to-br from-indigo-600 to-sky-600 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="space-y-2 text-center sm:text-left">
                  <span className="inline-block px-3 py-1 rounded-full bg-white/20 text-xs font-semibold tracking-wide">
                    Android & PWA Ready
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                    Створюйте та керуйте з ARTSS AI
                  </h2>
                  <p className="text-indigo-100 text-sm max-w-xl">
                    Використовуйте потужні мультимоделяри, редагуйте код, генеруйте зображення та малюйте на зручному онлайновому полотні.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSection("painter")}
                  className="px-6 py-3 bg-white text-indigo-600 hover:bg-indigo-50 font-semibold rounded-2xl shadow-lg transition transform hover:scale-105 flex items-center gap-2"
                >
                  <span>✎</span> Відкрити рисовалку
                </button>
              </div>

              <div className="flex-1 flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg">Чат з Агентом</h3>
                  {messages.length > 0 && (
                    <button type="button" onClick={newChat} className="text-xs text-zinc-500 hover:text-zinc-800">
                      Новий чат
                    </button>
                  )}
                </div>

                <div ref={threadRef} className="flex-1 overflow-y-auto space-y-4 pr-2 min-h-[300px] max-h-[500px]">
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-zinc-400 py-12">
                      <span className="text-4xl mb-3">✨</span>
                      <p className="text-sm font-medium">Почніть розмову або виберіть швидке завдання</p>
                    </div>
                  ) : (
                    messages.map((m, i) => (
                      <div key={i} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                        <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                          m.role === "user"
                            ? "bg-indigo-600 text-white rounded-br-xs"
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-bl-xs"
                        }`}>
                          <div className="whitespace-pre-wrap">{m.content}</div>
                          {m.imageUrl && (
                            <img src={m.imageUrl} alt="Generated" className="mt-3 rounded-xl max-h-64 object-cover cursor-pointer" onClick={() => setOpenedImage(m.imageUrl || null)} />
                          )}
                        </div>
                        {m.meta && <span className="text-[10px] text-zinc-400 mt-1 px-1">{m.meta}</span>}
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                  <AgentComposer
                    ref={composerRef}
                    onSend={submitPrompt}
                    busy={busy}
                    placeholder="Напишіть запит або завдання для агента..."
                  />
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      <StudioSettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={preferences}
        onChange={setStudioSettings}
      />
    </div>
  );
}
