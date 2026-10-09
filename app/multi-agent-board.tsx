"use client";

export type TeamProvider = "openai" | "deepseek" | "gemini" | "claude" | "mistral";
export type TeamMode = TeamProvider | "multi";
export type AgentRunReport = {
  strategy: "parallel" | "sequential";
  attempted: TeamProvider[];
  contributors: TeamProvider[];
  failed: TeamProvider[];
  synthesized: boolean;
  judge?: TeamProvider;
};
export type TeamLastRun = {
  task: string;
  mode: TeamMode;
  provider: string;
  duration: number;
  report: AgentRunReport;
};

const providers: { id: TeamProvider; name: string; symbol: string; focus: string }[] = [
  { id: "openai", name: "OpenAI", symbol: "◉", focus: "Код і структура" },
  { id: "deepseek", name: "DeepSeek", symbol: "≋", focus: "Розробка" },
  { id: "gemini", name: "Gemini", symbol: "✦", focus: "Дослідження" },
  { id: "claude", name: "Claude", symbol: "✳", focus: "Контекст" },
  { id: "mistral", name: "Mistral", symbol: "◇", focus: "Аналіз" },
];

type Props = {
  configured: TeamProvider[];
  selected: TeamMode;
  working: boolean;
  workingMode: TeamMode | null;
  last: TeamLastRun | null;
  onSelect: (mode: TeamMode) => void;
  onCompose: () => void;
  onStop: () => void;
  onNewChat: () => void;
};

export function MultiAgentBoard({ configured, selected, working, workingMode, last, onSelect, onCompose, onStop, onNewChat }: Props) {
  const parallel = configured.slice(0, 3);
  const hasTeam = configured.length > 1;
  return <aside className="multi-team-panel" id="team-status" aria-labelledby="team-heading">
    <div className="multi-team-heading">
      <div><span className="multi-team-eyebrow">ОРКЕСТРАЦІЯ МОДЕЛЕЙ</span><h2 id="team-heading">Команда агентів</h2></div>
      <span className="multi-team-live" title="Стан останнього запиту">
        <span className={working ? "pulse" : ""}/>
        {working ? "Виконується" : "Готово"}
      </span>
    </div>
    <p className="multi-team-desc">Один запит, кілька незалежних відповідей та фінальне зведення, коли це можливо.</p>
    <div className="multi-mode-switch" role="group" aria-label="Режим роботи агентів">
      <button type="button" className={selected === "multi" ? "active" : ""} disabled={working || !configured.length}
        aria-pressed={selected === "multi"} onClick={() => onSelect("multi")}>✦ Multi AI</button>
      <button type="button" className={selected !== "multi" ? "active" : ""} disabled={working || !configured.length}
        aria-pressed={selected !== "multi"} onClick={() => onSelect(configured[0] || "openai")}>◉ Одна модель</button>
    </div>
    <div className="multi-team-flow" aria-label="Етапи обробки">
      <span>01 <strong>Запит</strong></span><span className="multi-flow-arrow" aria-hidden="true">→</span>
      <span>02 <strong>Відповіді</strong></span><span className="multi-flow-arrow" aria-hidden="true">→</span>
      <span>03 <strong>Результат</strong></span>
    </div>
    <div className="multi-agents-title"><strong>Провайдери</strong><span>{configured.length} із 5 налаштовано</span></div>
    <div className="multi-agent-cards">
      {providers.map(p => {
        const enabled = configured.includes(p.id);
        const contribution = last?.report.contributors.includes(p.id);
        const failed = last?.report.failed.includes(p.id);
        const attempted = last?.report.attempted.includes(p.id);
        let state = !enabled ? "Ключ недоступний" : "Налаштовано";
        if (enabled && last && attempted) state = contribution ? "Відповів" : failed ? "Помилка запиту" : "Був запущений";
        // A pending HTTP call cannot reveal individual provider progress: label it honestly.
        if (enabled && working && (workingMode === "multi" ? parallel.includes(p.id) : workingMode === p.id)) state = "Очікування результату";
        return <button className={"multi-agent-card" + (selected === p.id ? " is-selected" : "")}
          type="button" key={p.id} disabled={!enabled || working} aria-pressed={selected === p.id}
          onClick={() => { onSelect(p.id); onCompose(); }}>
          <span className={"multi-agent-icon multi-icon-" + p.id} aria-hidden="true">{p.symbol}</span>
          <span className="multi-agent-copy"><strong>{p.name}</strong><small>{p.focus}</small></span>
          <span className={"multi-agent-state " + (contribution ? "success" : failed ? "error" : enabled ? "ready" : "missing")}><i/>{state}</span>
        </button>;
      })}
    </div>
    {last ? <div className="multi-last-run" role="status">
      <div className="multi-last-title"><strong>Останній результат</strong><span>{last.duration.toFixed(1)} с</span></div>
      <p title={last.task}>{last.task}</p>
      <div className="multi-last-details"><span>{last.report.strategy === "parallel" ? "Паралельно" : "Послідовно"}</span>
        <span>{last.report.contributors.length} відповіли</span>
        <span>{last.report.synthesized ? "Синтез підтверджено" : "Без синтезу"}</span>
      </div>
      {last.report.judge && last.report.synthesized ? <small>Підсумкова модель: {providers.find(p => p.id === last.report.judge)?.name}</small> : null}
    </div> : <div className="multi-no-report">
      <strong>Дані з реального запуску</strong>
      <p>Після першого запиту тут з&apos;являться фактичні учасники, результат і час виконання. Приклади не підставляються.</p>
    </div>}
    <div className="multi-team-actions">
      <button type="button" className="multi-run-button" disabled={working || !configured.length}
        onClick={() => { onSelect("multi"); onCompose(); }}>✦ Поставити задачу команді</button>
      {working ? <button type="button" className="multi-stop-button" onClick={onStop}>Зупинити запит</button> :
        <button type="button" className="multi-secondary-button" onClick={onNewChat}>Нова розмова</button>}
    </div>
    <p className="multi-team-disclaimer">Одночасно запускається до 3 моделей. Інші використовуються як резерв. Дані оновлюються після відповіді сервера, без імітації live-телеметрії.</p>
  </aside>;
}
