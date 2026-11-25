"use client";

import { useEffect, useRef, useState } from "react";

// Text you tap to edit in place. Return or tapping away saves; Escape puts it back.
export function InlineText({ value, onSave, label, className = "", maxLength = 200 }: { value: string; onSave: (v: string) => void; label: string; className?: string; maxLength?: number }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) return;
    const el = input.current;
    el?.focus();
    // Cursor at the end, ready to fix a typo or add a word
    if (el) el.setSelectionRange(el.value.length, el.value.length);
  }, [editing]);

  if (!editing) {
    return (
      <button type="button" className={`inline-text ${className}`} onClick={() => { setDraft(value); setEditing(true); }} aria-label={`${label}: ${value}. Tap to change the text.`}>
        {value}
      </button>
    );
  }

  const finish = (keep: boolean) => {
    const v = draft.trim();
    setEditing(false);
    if (keep && v && v !== value) onSave(v);
  };
  return (
    <form className={`inline-text-edit ${className}`} onSubmit={(e) => { e.preventDefault(); finish(true); }}>
      <input
        ref={input}
        aria-label={label}
        value={draft}
        maxLength={maxLength}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => finish(true)}
        onKeyDown={(e) => e.key === "Escape" && finish(false)}
        enterKeyHint="done"
        autoComplete="off"
      />
    </form>
  );
}
