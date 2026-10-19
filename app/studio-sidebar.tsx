import React from "react";

export type StudioSection = "home" | "code" | "team" | "runs" | "models" | "integrations" | "web" | "images" | "painter";

export function StudioSidebar({
  activeSection,
  onSelectSection,
  open,
  onClose,
}: {
  activeSection: StudioSection;
  onSelectSection: (section: StudioSection) => void;
  open: boolean;
  onClose: () => void;
}) {
  const items: { id: StudioSection; title: string; symbol: string; badge?: string }[] = [
    { id: "home", title: "Головна Студія", symbol: "⌂" },
    { id: "painter", title: "Онлайн Рисовалка", symbol: "✎", badge: "NEW" },
    { id: "code", title: "Редактор Коду", symbol: "⟨/⟩" },
    { id: "team", title: "Multi-Agent Команда", symbol: "✳" },
    { id: "images", title: "Генератор Зображень", symbol: "❖" },
    { id: "web", title: "Веб Пошук та Аналіз", symbol: "🌐" },
    { id: "runs", title: "Історія Запусків", symbol: "⚡" },
    { id: "models", title: "ШІ Моделі", symbol: "◎" },
    { id: "integrations", title: "Інтеграції та Ключі", symbol: "⚙" },
  ];

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 flex flex-col transition-transform duration-300 lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-16 px-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-indigo-600 to-sky-500 bg-clip-text text-transparent">
            ARTSS AI Studio
          </span>
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
          {items.map(item => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectSection(item.id);
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                  isActive
                    ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-semibold"
                    : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
                }`}
              >
                <span className="flex items-center gap-3">
                  <span className="text-base w-5 text-center">{item.symbol}</span>
                  {item.title}
                </span>
                {item.badge && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-600 text-white">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-400 text-center">
          ARTSS Apps v0.1 • Android & PWA Ready
        </div>
      </aside>
    </>
  );
}
