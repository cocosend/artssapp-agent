"use client";

import { useEffect } from "react";
import { ArtssMark } from "./artss-mark";

export type StudioSection = "home" | "code" | "web" | "images" | "models" | "integrations" | "runs";

const navigation: { id: StudioSection; icon: string; title: string; subtitle: string }[] = [
  { id: "home", icon: "⌂", title: "Студія", subtitle: "Робочий простір" },
  { id: "code", icon: "〈/〉", title: "Онлайн-кодинг", subtitle: "GitHub файли" },
  { id: "web", icon: "◎", title: "Інтернет", subtitle: "Пошук із джерелами" },
  { id: "images", icon: "▧", title: "Зображення", subtitle: "Створення AI" },
  { id: "models", icon: "✳", title: "AI моделі", subtitle: "Маршрутизація" },
  { id: "integrations", icon: "⬡", title: "Підключення", subtitle: "Стан сервісів" },
  { id: "runs", icon: "◷", title: "Запуски", subtitle: "Результати роботи" },
];

type Props = {
  open: boolean;
  active: StudioSection;
  busy: boolean;
  onClose: () => void;
  onNavigate: (id: StudioSection) => void;
  onSettings: () => void;
  onNewChat: () => void;
};

export function StudioSidebar({ open, active, busy, onClose, onNavigate, onSettings, onNewChat }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return <>
    {open ? <button type="button" className="studio-sidebar-scrim" onClick={onClose} aria-label="Закрити меню"/> : null}
    <aside className={"studio-sidebar" + (open ? " is-open" : "")} id="studio-nav" aria-label="Головна навігація">
      <div className="studio-sidebar-brand"><span className="studio-sidebar-logo"><ArtssMark size={31}/></span>
        <span><strong>ARTSS AI</strong><small>PRIVATE AGENT STUDIO</small></span>
        <button type="button" className="studio-sidebar-close" aria-label="Закрити меню" onClick={onClose}>×</button>
      </div>
      <div className="studio-sidebar-caption">РОБОЧІ ІНСТРУМЕНТИ</div>
      <nav className="studio-nav-links">
        {navigation.map(item => <button type="button" key={item.id}
          className={"studio-nav-item" + (active === item.id ? " active" : "")}
          aria-current={active === item.id ? "page" : undefined}
          onClick={() => onNavigate(item.id)}>
          <span className="studio-nav-symbol" aria-hidden="true">{item.icon}</span>
          <span><strong>{item.title}</strong><small>{item.subtitle}</small></span>
          <span className="studio-nav-arrow" aria-hidden="true">›</span>
        </button>)}
      </nav>
      <div className="studio-sidebar-bottom">
        <button type="button" onClick={onSettings}>⚙ <span>Налаштування</span></button>
        <button type="button" onClick={onNewChat} disabled={busy}>＋ <span>Новий запит</span></button>
        <p>Онлайн-кодинг редагує локальну чернетку. Запис у GitHub потребує дозволу сервера.</p>
      </div>
    </aside>
  </>;
}
