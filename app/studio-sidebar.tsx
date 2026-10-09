"use client";

import { useEffect, useState } from "react";
import { ArtssMark } from "./artss-mark";

export type StudioSection = "home" | "code" | "web" | "images" | "models" | "integrations" | "runs";

const groups: { id: string; title: string; icon: string; items: { id: StudioSection; icon: string; title: string; subtitle: string }[] }[] = [
  { id: "work", title: "Робочий простір", icon: "▤", items: [
    { id: "home", icon: "⌂", title: "AI студія", subtitle: "Ваші запити" },
    { id: "code", icon: "〈/〉", title: "Онлайн-кодинг", subtitle: "Файли GitHub" },
    { id: "web", icon: "◎", title: "Інтернет", subtitle: "Пошук та джерела" },
    { id: "images", icon: "▧", title: "Зображення", subtitle: "Генерація AI" },
  ]},
  { id: "systems", title: "Моделі та система", icon: "◫", items: [
    { id: "models", icon: "✳", title: "AI-моделі", subtitle: "Вибір провайдера" },
    { id: "integrations", icon: "⬡", title: "Інтеграції", subtitle: "Статус підключень" },
    { id: "runs", icon: "◷", title: "Запуски", subtitle: "Історія задач" },
  ]},
];

type Props = {
  open: boolean;
  active: StudioSection;
  busy: boolean;
  onClose: () => void;
  onNavigate: (id: StudioSection) => void;
  onSettings: () => void;
  onNewChat: () => void;
  onCollapse: () => void;
};

export function StudioSidebar({ open, active, busy, onClose, onNavigate, onSettings, onNewChat, onCollapse }: Props) {
  const [expandedGroup, setExpandedGroup] = useState<string | null>("work");
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return <>
    {open ? <button type="button" className="studio-sidebar-scrim" onClick={onClose} aria-label="Закрити меню"/> : null}
    <aside className={"studio-sidebar night-sidebar" + (open ? " is-open" : "")} id="studio-nav" aria-label="Навігація ARTSS AI">
      <div className="studio-sidebar-brand">
        <span className="studio-sidebar-logo"><ArtssMark size={30}/></span>
        <span><strong>ARTSS AI</strong><small>BLUE NIGHT STUDIO</small></span>
        <button type="button" className="studio-sidebar-close" aria-label="Закрити меню" onClick={onClose}>×</button>
      </div>
      <div className="studio-sidebar-caption">НАВІГАЦІЯ</div>
      <nav className="studio-nav-links night-stairs" aria-label="Розділи">
        {groups.map(group => <details key={group.id} className="night-stair-group" open={expandedGroup === group.id}>
          <summary className="night-stair-summary" onClick={event => { event.preventDefault(); setExpandedGroup(previous => previous === group.id ? null : group.id); }}>
            <span aria-hidden="true">{group.icon}</span><strong>{group.title}</strong><span className="night-stair-arrow" aria-hidden="true">⌄</span>
          </summary>
          <div className="night-stair-children">
            {group.items.map(item => <button type="button" key={item.id}
              className={"studio-nav-item night-stair-item" + (active === item.id ? " active" : "")}
              aria-current={active === item.id ? "page" : undefined}
              onClick={() => onNavigate(item.id)}>
              <span className="studio-nav-symbol" aria-hidden="true">{item.icon}</span>
              <span><strong>{item.title}</strong><small>{item.subtitle}</small></span>
              <span className="studio-nav-arrow" aria-hidden="true">›</span>
            </button>)}
          </div>
        </details>)}
      </nav>
      <div className="studio-sidebar-bottom night-sidebar-bottom">
        <button type="button" onClick={onSettings}><span aria-hidden="true">⚙</span> Налаштування</button>
        <button type="button" onClick={onNewChat} disabled={busy}><span aria-hidden="true">＋</span> Новий запит</button>
        <button type="button" className="night-sidebar-collapse" onClick={onCollapse}><span aria-hidden="true">←</span> Згорнути панель</button>
        <p>Робочі інструменти згруповано в бічному меню. Натисніть на групу, щоб розгорнути її.</p>
      </div>
    </aside>
  </>;
}
