"use client";

import { useState } from "react";
import { addDays, fmt, fromIsoDay, isoDay } from "@/lib/dates";
import { describeRepeat, type DayEntry, type DayRepeat, type DayTodo, type DayTodos } from "@/lib/useDayTodos";
import type { Member } from "@/lib/types";
import { Avatar } from "./Avatar";
import { FeatureSheet } from "./FeatureSheet";

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type ListProps = {
  iso: string;
  todayIso: string;
  entries: DayEntry[];
  dt: DayTodos;
  members: Member[];
  photos: Record<string, string>;
  me: Member | null;
  compact?: boolean;
  onEdit: (t: DayTodo) => void;
  onRepeats: () => void;
};

// The to-do list under one day: tick boxes, carried-over jobs marked, and a quick add
export function DayTodoList({ iso, todayIso, entries, dt, members, photos, me, compact, onEdit, onRepeats }: ListProps) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const past = iso < todayIso;
  const memberOf = (id: string | null) => members.find((m) => m.id === id);
  const open = entries.filter((e) => e.kind === "planned" || !e.todo.done).length;

  if (past && entries.length === 0) return null;

  return (
    <div className={`dt${compact ? " is-compact" : ""}`}>
      {!compact && entries.length > 0 && (
        <div className="dt-head">
          <span className="dt-label">✓ To do{open ? <span className="dt-count">{open}</span> : null}</span>
          <button type="button" className="dt-link" onClick={onRepeats} title="Jobs that come round every day, week or month">↻ Regular jobs</button>
        </div>
      )}
      {entries.length > 0 && (
        <ul className="dt-list">
          {entries.map((e) => {
            if (e.kind === "planned") {
              const who = memberOf(e.repeat.assignee);
              return (
                <li key={`p-${e.repeat.id}`} className="dt-item is-planned">
                  <button type="button" className="dt-tick" onClick={() => dt.tickPlanned(e.repeat, e.date)} aria-label={`Done early: ${e.repeat.title}`}>
                    <span className="dt-box" aria-hidden="true" style={{ borderColor: who?.colour }} />
                  </button>
                  <button type="button" className="dt-title" onClick={onRepeats} title={describeRepeat(e.repeat)}>
                    {e.repeat.title} <span className="dt-rep" aria-label="repeats">↻</span>
                  </button>
                  {who && <Avatar member={who} size={compact ? 18 : 24} photoUrl={photos[who.id]} />}
                </li>
              );
            }
            const t = e.todo;
            const who = memberOf(t.assignee);
            return (
              <li key={t.id} className={`dt-item${t.done ? " is-done" : ""}${e.carried ? " is-carried" : ""}`}>
                <button type="button" className="dt-tick" onClick={() => dt.toggle(t)} aria-pressed={t.done} aria-label={t.done ? `Not done: ${t.title}` : `Done: ${t.title}`}>
                  <span className="dt-box" aria-hidden="true" style={{ borderColor: t.done ? undefined : who?.colour }}>{t.done ? "✓" : ""}</span>
                </button>
                <button type="button" className="dt-title" onClick={() => onEdit(t)}>
                  {t.title}
                  {t.repeat_id && <span className="dt-rep" aria-label="repeats"> ↻</span>}
                  {e.carried && <span className="dt-from">from {fromLabel(t.date, todayIso)}</span>}
                </button>
                {who && <Avatar member={who} size={compact ? 18 : 24} photoUrl={photos[who.id]} />}
              </li>
            );
          })}
        </ul>
      )}
      {!past &&
        (adding ? (
          <form
            className="dt-add"
            onSubmit={(ev) => {
              ev.preventDefault();
              if (text.trim()) dt.add(iso, text, me?.id ?? null);
              setText("");
            }}
          >
            <input
              autoFocus
              aria-label={`Add a to-do for ${fmt(fromIsoDay(iso), { weekday: "long" })}`}
              placeholder="Hoover, change beds…"
              value={text}
              onChange={(ev) => setText(ev.target.value)}
              onBlur={() => {
                if (text.trim()) dt.add(iso, text, me?.id ?? null);
                setText("");
                setAdding(false);
              }}
              enterKeyHint="done"
              autoComplete="off"
            />
          </form>
        ) : (
          <div className="dt-foot">
            <button type="button" className="dt-new" onClick={() => setAdding(true)}>+ To do</button>
            {!compact && entries.length === 0 && <button type="button" className="dt-link" onClick={onRepeats} title="Jobs that come round every day, week or month">↻ Regular jobs</button>}
          </div>
        ))}
    </div>
  );
}

function fromLabel(date: string, todayIso: string) {
  const days = Math.round((fromIsoDay(todayIso).getTime() - fromIsoDay(date).getTime()) / 864e5);
  if (days === 1) return "yesterday";
  if (days < 7) return fmt(fromIsoDay(date), { weekday: "long" });
  return fmt(fromIsoDay(date), { day: "numeric", month: "short" });
}

// ---------- sheets ----------

export function DayTodoSheets({
  dt,
  members,
  photos,
  editing,
  repeatsOpen,
  onCloseEdit,
  onCloseRepeats,
  onOpenRepeats,
}: {
  dt: DayTodos;
  members: Member[];
  photos: Record<string, string>;
  editing: DayTodo | null;
  repeatsOpen: boolean;
  onCloseEdit: () => void;
  onCloseRepeats: () => void;
  onOpenRepeats: () => void;
}) {
  return (
    <>
      <FeatureSheet open={editing !== null} title="To-do" onClose={onCloseEdit}>
        {editing && (
          <EditDayTodo
            key={editing.id}
            todo={editing}
            repeat={dt.repeats.find((r) => r.id === editing.repeat_id) ?? null}
            members={members}
            photos={photos}
            onSave={(patch) => {
              dt.update(editing.id, patch);
              onCloseEdit();
            }}
            onDelete={() => {
              dt.remove(editing.id);
              onCloseEdit();
            }}
            onRepeats={() => {
              onCloseEdit();
              onOpenRepeats();
            }}
          />
        )}
      </FeatureSheet>
      <FeatureSheet open={repeatsOpen} title="Regular jobs" onClose={onCloseRepeats}>
        {repeatsOpen && <Repeats dt={dt} members={members} photos={photos} />}
      </FeatureSheet>
    </>
  );
}

function WhoPicker({ members, photos, who, setWho, legend }: { members: Member[]; photos: Record<string, string>; who: string | null; setWho: (id: string | null) => void; legend: string }) {
  return (
    <fieldset className="who-picker">
      <legend>{legend}</legend>
      <button type="button" className={`who-pick everyone${who === null ? " is-on" : ""}`} aria-pressed={who === null} onClick={() => setWho(null)}>
        <span className="everyone-badge" aria-hidden="true">★</span>
        Anyone
      </button>
      {members.map((m) => (
        <button key={m.id} type="button" className={`who-pick${who === m.id ? " is-on" : ""}`} style={{ ["--c" as string]: m.colour }} aria-pressed={who === m.id} onClick={() => setWho(m.id)}>
          <Avatar member={m} size={40} photoUrl={photos[m.id]} />
          {m.name}
        </button>
      ))}
    </fieldset>
  );
}

function EditDayTodo({ todo, repeat, members, photos, onSave, onDelete, onRepeats }: { todo: DayTodo; repeat: DayRepeat | null; members: Member[]; photos: Record<string, string>; onSave: (p: Partial<DayTodo>) => void; onDelete: () => void; onRepeats: () => void }) {
  const [title, setTitle] = useState(todo.title);
  const [who, setWho] = useState<string | null>(todo.assignee);
  const [date, setDate] = useState(todo.date);
  const today = new Date();
  return (
    <form
      className="fx-stack"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ title: title.trim() || todo.title, assignee: who, date });
      }}
    >
      <input className="title-input" aria-label="To-do" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
      <WhoPicker members={members} photos={photos} who={who} setWho={setWho} legend="Whose job?" />
      <label className="field">
        <span>Day</span>
        <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
      </label>
      <div className="usuals fx-quick-dates">
        <button type="button" className="chip" onClick={() => setDate(isoDay(today))}>Today</button>
        <button type="button" className="chip" onClick={() => setDate(isoDay(addDays(today, 1)))}>Tomorrow</button>
      </div>
      {repeat && (
        <p className="sheet-hint">
          ↻ {describeRepeat(repeat)}.{" "}
          <button type="button" className="dt-link" onClick={onRepeats}>Change or stop repeating</button>
        </p>
      )}
      <div className="sheet-actions">
        <button type="button" className="btn btn-danger" onClick={onDelete}>Delete</button>
        <span className="spacer" />
        <button className="btn btn-primary btn-big">Save</button>
      </div>
    </form>
  );
}

type Freq = "daily" | "weekly" | "fortnightly" | "monthly";

function Repeats({ dt, members, photos }: { dt: DayTodos; members: Member[]; photos: Record<string, string> }) {
  const [editing, setEditing] = useState<DayRepeat | "new" | null>(dt.repeats.length ? null : "new");
  const memberOf = (id: string | null) => members.find((m) => m.id === id);

  if (editing) {
    return (
      <RepeatForm
        key={editing === "new" ? "new" : editing.id}
        repeat={editing === "new" ? null : editing}
        members={members}
        photos={photos}
        onCancel={() => setEditing(null)}
        onSave={async (r) => {
          await dt.saveRepeat(r);
          setEditing(null);
        }}
        onDelete={async (id) => {
          await dt.deleteRepeat(id);
          setEditing(null);
        }}
      />
    );
  }

  return (
    <div className="fx-stack">
      <p className="sheet-hint">These turn up on the calendar by themselves. If one isn&apos;t ticked, it carries over to the next day until it is.</p>
      {dt.repeats.length > 0 && (
        <ul className="fx-rows">
          {dt.repeats.map((r) => {
            const who = memberOf(r.assignee);
            return (
              <li key={r.id}>
                <button type="button" className="fx-row fx-link" onClick={() => setEditing(r)}>
                  {who ? <Avatar member={who} size={36} photoUrl={photos[who.id]} /> : <span className="fx-icon" aria-hidden="true">↻</span>}
                  <span className="fx-row-text">
                    <strong>{r.title}</strong>
                    <span className="fx-sub">{describeRepeat(r)}</span>
                  </span>
                  <span className="fx-chev" aria-hidden="true">›</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <button type="button" className="btn btn-primary btn-big" onClick={() => setEditing("new")}>+ New regular job</button>
    </div>
  );
}

function RepeatForm({
  repeat,
  members,
  photos,
  onCancel,
  onSave,
  onDelete,
}: {
  repeat: DayRepeat | null;
  members: Member[];
  photos: Record<string, string>;
  onCancel: () => void;
  onSave: (r: Omit<DayRepeat, "id" | "household_id" | "created_at"> & { id?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const todayIso = isoDay(new Date());
  const [title, setTitle] = useState(repeat?.title ?? "");
  const [who, setWho] = useState<string | null>(repeat?.assignee ?? null);
  const [freq, setFreq] = useState<Freq>(!repeat ? "weekly" : repeat.freq === "weekly" && repeat.interval === 2 ? "fortnightly" : repeat.freq);
  const [byDay, setByDay] = useState<number[]>(repeat?.by_day.length ? repeat.by_day : [(new Date().getDay() + 6) % 7]);
  const [start, setStart] = useState(repeat?.start_date ?? todayIso);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="fx-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        setBusy(true);
        await onSave({
          id: repeat?.id,
          title,
          assignee: who,
          freq: freq === "fortnightly" ? "weekly" : freq,
          interval: freq === "fortnightly" ? 2 : 1,
          by_day: freq === "weekly" || freq === "fortnightly" ? [...byDay].sort() : [],
          start_date: start,
        });
      }}
    >
      <input className="title-input" aria-label="Job" placeholder="Clean the bathroom" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus={!repeat} maxLength={200} />
      <WhoPicker members={members} photos={photos} who={who} setWho={setWho} legend="Whose job?" />
      <div className="field">
        <span>How often</span>
        <div className="ends-options" role="radiogroup" aria-label="How often">
          {([["daily", "Every day"], ["weekly", "Every week"], ["fortnightly", "Every 2 weeks"], ["monthly", "Every month"]] as const).map(([v, l]) => (
            <button key={v} type="button" role="radio" aria-checked={freq === v} className={`ends-option${freq === v ? " is-on" : ""}`} onClick={() => setFreq(v)}>{l}</button>
          ))}
        </div>
      </div>
      {(freq === "weekly" || freq === "fortnightly") && (
        <div className="day-chips" role="group" aria-label="On these days">
          {DAY_LETTERS.map((l, i) => (
            <button
              key={i}
              type="button"
              className={`day-chip${byDay.includes(i) ? " is-on" : ""}`}
              aria-label={DAY_NAMES[i]}
              aria-pressed={byDay.includes(i)}
              onClick={() => setByDay((d) => (d.includes(i) ? (d.length > 1 ? d.filter((x) => x !== i) : d) : [...d, i]))}
            >
              {l}
            </button>
          ))}
        </div>
      )}
      <label className="field">
        <span>{freq === "monthly" ? "First time (it repeats on this date each month)" : "Starting"}</span>
        <input type="date" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} />
      </label>
      <div className="sheet-actions">
        {repeat ? (
          <button type="button" className="btn btn-danger" disabled={busy} onClick={() => confirm(`Stop “${repeat.title}” repeating? Ticked ones stay in the calendar.`) && onDelete(repeat.id)}>
            Stop repeating
          </button>
        ) : (
          <button type="button" className="btn btn-quiet" onClick={onCancel}>Back</button>
        )}
        <span className="spacer" />
        <button className="btn btn-primary btn-big" disabled={busy || !title.trim()}>{busy ? "Saving…" : repeat ? "Save" : "Add job"}</button>
      </div>
    </form>
  );
}
