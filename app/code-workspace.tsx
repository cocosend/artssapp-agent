"use client";

import { useCallback, useEffect, useState } from "react";

type FileReply = { path: string; content: string; sha: string; ref: string; error?: string };
type Props = { onSendToAgent: (text: string) => void; onClose: () => void; githubWrite: boolean; };

const initialPaths = ["app/page.tsx", "app/agent-composer.tsx", "app/flagship.css", "app/api/web-search/route.ts"];

export function CodeWorkspace({ onSendToAgent, onClose, githubWrite }: Props) {
  const [paths, setPaths] = useState<string[]>(initialPaths);
  const [path, setPath] = useState(initialPaths[0]);
  const [original, setOriginal] = useState("");
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const ctrl = new AbortController();
    void fetch("/api/code-workspace", { cache: "no-store", signal: ctrl.signal })
      .then(async response => response.ok ? response.json() : null)
      .then((data: { files?: string[] } | null) => {
        if (!ctrl.signal.aborted && Array.isArray(data?.files)) {
          setPaths(data.files);
        }
      }).catch(() => {});
    return () => ctrl.abort();
  }, []);

  const load = useCallback((next: string) => {
    const controller = new AbortController();
    setStatus("loading"); setError(""); setNotice("");
    void fetch("/api/code-workspace?path=" + encodeURIComponent(next), { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const result: FileReply = await response.json().catch(() => ({ path: next, content: "", sha: "", ref: "", error: "Invalid response." }));
        if (!response.ok) throw new Error(result.error || "Cannot fetch source.");
        if (!controller.signal.aborted) { setOriginal(result.content); setDraft(result.content); setStatus("ready"); }
      }).catch(err => {
        if (!controller.signal.aborted) {
          setStatus("error"); setError(err instanceof Error ? err.message : "Завантаження недоступне.");
        }
      });
    return () => controller.abort();
  }, []);

  useEffect(() => load(path), [path, load]);

  const changed = draft !== original;
  const lines = draft.split("\n").length;

  async function copy() {
    try { await navigator.clipboard.writeText(draft); setNotice("Код скопійовано."); }
    catch { setNotice("Не вдалося скопіювати."); }
  }

  function send() {
    if (!changed || draft.length > 10500) {
      setNotice(draft.length > 10500 ? "Файл задовгий для запиту. Скоротіть зміни до 10 500 символів." : "Немає змін для передачі.");
      return;
    }
    // The existing authenticated agent decides preview/PR according to server permissions.
    // Never execute code in the browser or commit silently.
    onSendToAgent("Перевір і запропонуй застосування цього зміненого файлу до репозиторію cocosend/artssapp-agent.\n" +
      "Шлях: " + path + "\n" +
      "Вимоги: поясни ризики, перевір логіку, тести та формат, не змінюй main напряму. " +
      (githubWrite ? "Якщо виконання дозволено сервером — створи окрему гілку і PR. " : "GitHub запис не налаштований; покажи лише preview план. ") +
      "\nОНОВЛЕНИЙ ПОВНИЙ ВМІСТ ФАЙЛУ:\n```\n" + draft + "\n```");
  }

  return <section className="online-code-studio" aria-label="Онлайн-кодинг ARTSS AI">
    <header className="code-studio-head">
      <div><span className="code-studio-kicker">ONLINE CODE · GITHUB MAIN</span>
        <h2>Код. Без зайвих переходів.</h2>
        <p>Читайте реальні файли GitHub, редагуйте чернетку і передавайте зміни агенту на перевірку.</p>
      </div>
      <button type="button" className="code-studio-exit" onClick={onClose}>До студії ↗</button>
    </header>
    <div className="code-studio-grid">
      <div className="code-file-list"><strong>Файли репозиторію</strong>
        {paths.map(p => <button type="button" key={p} className={p === path ? "active" : ""}
          aria-pressed={p === path}
          onClick={() => { if (p === path) return; if (changed && !window.confirm("Незбережену локальну чернетку буде втрачено. Відкрити інший файл?")) return; setPath(p); }}>
          <span aria-hidden="true">⌘</span><span>{p.split("/").at(-1)}<small>{p}</small></span></button>)}
      </div>
      <div className="code-edit-area">
        <div className="code-editor-toolbar"><span><strong>{path}</strong><small>{status === "loading" ? "Завантаження…" : status === "ready" ? changed ? "Локально змінено" : "GitHub · main" : "Недоступно"}</small></span><span>{lines} рядків</span></div>
        {status === "error" ? <div className="code-fetch-error" role="alert">{error}<button type="button" onClick={() => load(path)}>Повторити</button></div> : null}
        <label className="pm-sr-only" htmlFor="online-code-editor">Редактор вихідного коду</label>
        <textarea id="online-code-editor" className="online-code-editor" spellCheck={false} autoCapitalize="off" autoCorrect="off"
          aria-label="Онлайн-редактор" value={draft} onChange={e => setDraft(e.target.value)}
          disabled={status !== "ready"} placeholder="Код завантажується з GitHub…" />
        <div className="code-editor-actions">
          <button type="button" onClick={() => { setDraft(original); setNotice("Чернетку скинуто."); }} disabled={status !== "ready" || !changed}>Скинути зміни</button>
          <button type="button" onClick={() => { void copy(); }} disabled={status !== "ready"}>Скопіювати</button>
          <button className="code-submit" type="button" onClick={send} disabled={status !== "ready" || !changed}>Перевірити через AI ↗</button>
        </div>
        {notice ? <p className="code-editor-notice" role="status">{notice}</p> : null}
        <p className="code-editor-disclaimer">Жодного виконання довільного коду на сервері. Запис у GitHub: {githubWrite ? "ключ налаштовано; залежить від дозволу виконання" : "недоступний без GITHUB_TOKEN"}. Передача агенту не означає автоматичний commit.</p>
      </div>
    </div>
  </section>;
}
