"use client";

import { useEffect, useState } from "react";
import { imageAspects, imageQualities, type ImageAspect, type ImageQuality } from "@/lib/image-options";

export type StudioModel = "multi" | "openai" | "deepseek" | "gemini" | "claude" | "mistral";
export type StudioSettings = {
  density: "comfortable" | "compact";
  motion: "system" | "reduced";
  effects: boolean;
  textSize: "normal" | "large";
  imageAspect: ImageAspect;
  imageQuality: ImageQuality;
  model: StudioModel;
};

export const DEFAULT_SETTINGS: StudioSettings = {
  density: "comfortable", motion: "system", effects: true, textSize: "normal",
  imageAspect: "square", imageQuality: "low", model: "multi",
};

const models: { value: StudioModel; label: string }[] = [
  { value: "multi", label: "Multi AI" }, { value: "openai", label: "OpenAI" },
  { value: "claude", label: "Claude" }, { value: "gemini", label: "Gemini" },
  { value: "deepseek", label: "DeepSeek" }, { value: "mistral", label: "Mistral" },
];

export function sanitizeSettings(value: unknown): StudioSettings {
  if (typeof value !== "object" || value === null) return { ...DEFAULT_SETTINGS };
  const x = value as Record<string, unknown>;
  return {
    density: x.density === "compact" ? "compact" : "comfortable",
    motion: x.motion === "reduced" ? "reduced" : "system",
    effects: x.effects !== false,
    textSize: x.textSize === "large" ? "large" : "normal",
    imageAspect: imageAspects.includes(x.imageAspect as ImageAspect) ? x.imageAspect as ImageAspect : "square",
    imageQuality: imageQualities.includes(x.imageQuality as ImageQuality) ? x.imageQuality as ImageQuality : "low",
    model: models.find(m => m.value === x.model)?.value || "multi",
  };
}

type Props = {
  open: boolean;
  value: StudioSettings;
  onChange: (next: StudioSettings) => void;
  onClose: () => void;
  onNewChat: () => void;
  onRefresh: () => void;
  busy: boolean;
};

export function StudioSettingsPanel({ open, value, onChange, onClose, onNewChat, onRefresh, busy }: Props) {
  const [viewport, setViewport] = useState("");
  useEffect(() => {
    if (!open) return;
    const update = () => {
      setViewport(Math.round(window.innerWidth) + " × " + Math.round(window.innerHeight) +
        " CSS px · DPR " + Math.round(window.devicePixelRatio * 100) / 100);
    };
    update();
    window.addEventListener("resize", update, { passive: true });
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("resize", update); window.removeEventListener("keydown", onKey); };
  }, [open, onClose]);
  if (!open) return null;
  const update = <K extends keyof StudioSettings>(key: K, next: StudioSettings[K]) => onChange({ ...value, [key]: next });

  return <div className="studio-settings-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="studio-settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-heading">
      <header className="settings-head">
        <div><span className="settings-eyebrow">ARTSS AI · PRIVATE</span><h2 id="settings-heading">Налаштування</h2><p>Точна адаптація інтерфейсу під ваш iPhone.</p></div>
        <button type="button" className="settings-close" onClick={onClose} aria-label="Закрити налаштування">×</button>
      </header>
      <div className="settings-body">
        <fieldset className="settings-group"><legend>Інтерфейс та плавність</legend>
          <label htmlFor="setting-density">Щільність карток</label>
          <select id="setting-density" value={value.density} onChange={e => update("density", e.target.value as StudioSettings["density"])}>
            <option value="comfortable">Комфортна</option><option value="compact">Компактна</option>
          </select>
          <label htmlFor="setting-text">Розмір тексту</label>
          <select id="setting-text" value={value.textSize} onChange={e => update("textSize", e.target.value as StudioSettings["textSize"])}>
            <option value="normal">Стандартний</option><option value="large">Збільшений</option>
          </select>
          <label htmlFor="setting-motion">Анімація</label>
          <select id="setting-motion" value={value.motion} onChange={e => update("motion", e.target.value as StudioSettings["motion"])}>
            <option value="system">Як на пристрої</option><option value="reduced">Мінімальна</option>
          </select>
          <label className="settings-toggle"><input type="checkbox" checked={value.effects} onChange={e => update("effects", e.target.checked)}/><span>Яскраві світлові ефекти<small>Вимкніть для економії заряду та слабших пристроїв.</small></span></label>
        </fieldset>
        <fieldset className="settings-group"><legend>AI та зображення</legend>
          <label htmlFor="setting-model">Модель за замовчуванням</label>
          <select id="setting-model" value={value.model} onChange={e => update("model", e.target.value as StudioModel)}>
            {models.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <label htmlFor="setting-aspect">Формат зображення</label>
          <select id="setting-aspect" value={value.imageAspect} onChange={e => update("imageAspect", e.target.value as ImageAspect)}>
            <option value="square">1:1 · 1024 × 1024</option>
            <option value="landscape">3:2 · 1536 × 1024</option>
            <option value="portrait">2:3 · 1024 × 1536</option>
          </select>
          <label htmlFor="setting-quality">Якість генерації</label>
          <select id="setting-quality" value={value.imageQuality} onChange={e => update("imageQuality", e.target.value as ImageQuality)}>
            <option value="low">Швидка · економна</option>
            <option value="medium">Збалансована</option>
            <option value="high">Детальна · дорожча</option>
          </select>
          <p className="settings-explain">Формат і якість передаються безпосередньо серверній генерації зображень. Вища якість може коштувати дорожче.</p>
        </fieldset>
        <fieldset className="settings-group"><legend>Сесія та екран</legend>
          <div className="settings-device"><strong>Поточний екран</strong><span>{viewport || "Визначення…"}</span><small>Розміри CSS viewport; фізична діагональ не визначається браузером.</small></div>
          <div className="settings-buttons">
            <button type="button" onClick={() => { onRefresh(); onClose(); }}>Оновити підключення</button>
            <button type="button" disabled={busy} onClick={() => { onNewChat(); onClose(); }}>Нова розмова</button>
          </div>
        </fieldset>
      </div>
      <footer className="settings-footer"><span>Параметри зберігаються лише в цьому браузері. API-ключі тут не зберігаються.</span><button type="button" onClick={onClose}>Готово</button></footer>
    </section>
  </div>;
}
