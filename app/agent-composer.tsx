"use client";

import { forwardRef, memo, useImperativeHandle, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

export type ComposerHandle = { fill: (text: string) => void; focus: () => void; restoreIfEmpty: (text: string) => void };

type Props = {
  model: string;
  busy: boolean;
  unavailable: boolean;
  onSend: (text: string) => void;
};

const Arrow = () => <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>;
const Lock = () => <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></svg>;

export const AgentComposer = memo(forwardRef<ComposerHandle, Props>(function AgentComposer(
  { model, busy, unavailable, onSend }, ref
) {
  const [draft, setDraft] = useState("");
  const textarea = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    fill(text: string) {
      setDraft(text);
      textarea.current?.focus({ preventScroll: true });
      textarea.current?.scrollIntoView({ block: "nearest", behavior: "auto" });
    },
    focus() { textarea.current?.focus({ preventScroll: true }); },
    restoreIfEmpty(text: string) { setDraft(previous => previous.trim() ? previous : text); },
  }), []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy || unavailable) return;
    setDraft("");
    onSend(text);
  }

  function keyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // iOS software keyboards keep the Return key for multiline editing.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing &&
      !window.matchMedia("(pointer: coarse)").matches) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return <form className="pm-composer" onSubmit={submit}>
    <label className="pm-sr-only" htmlFor="pm-task">Завдання для агента</label>
    <textarea ref={textarea} id="pm-task" value={draft} maxLength={12000} rows={3}
      onChange={event => setDraft(event.target.value)} onKeyDown={keyDown}
      placeholder="Напишіть, що потрібно зробити…" aria-label="Завдання для агента"
      disabled={busy} enterKeyHint="enter" />
    <div className="pm-composer-bottom">
      <span><Lock /> Приватна сесія · {model}</span>
      <button className="pm-submit" type="submit" disabled={busy || unavailable || !draft.trim()}>
        {busy ? "Обробка…" : "Надіслати"}<Arrow />
      </button>
    </div>
  </form>;
}));
