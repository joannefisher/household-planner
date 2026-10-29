"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, fmt, fromIsoDay, isoDay } from "@/lib/dates";
import type { Member } from "@/lib/types";
import { useTodos, type TodoItem, type TodoList } from "@/lib/useTodos";
import { Avatar } from "./Avatar";
import { FeatureSheet } from "./FeatureSheet";

const PICK_KEY = "planner.todoList";
const EMOJIS = ["✅", "🏠", "🧹", "🛠️", "🎒", "🧳", "🎄", "🎂", "🐶", "🚗", "💼", "🌱", "📚", "💊", "🎁", "⭐"];
const STARTERS: [string, string][] = [["🏠", "Jobs around the house"], ["🎒", "School"], ["🧳", "Holiday packing"]];

function readPick() {
  try {
    return localStorage.getItem(PICK_KEY);
  } catch {
    return null;
  }
}
function writePick(id: string) {
  try {
    localStorage.setItem(PICK_KEY, id);
  } catch {}
}

export function dueLabel(due: string, today: string): { text: string; tone: "" | "is-soon" | "is-late" } {
  if (due < today) return { text: `Was due ${fmt(fromIsoDay(due), { day: "numeric", month: "short" })}`, tone: "is-late" };
  if (due === today) return { text: "Today", tone: "is-soon" };
  if (due === isoDay(addDays(fromIsoDay(today), 1))) return { text: "Tomorrow", tone: "is-soon" };
  const days = (fromIsoDay(due).getTime() - fromIsoDay(today).getTime()) / 864e5;
  return { text: fmt(fromIsoDay(due), days < 7 ? { weekday: "long" } : { weekday: "short", day: "numeric", month: "short" }), tone: "" };
}

type Props = { householdId: string; members: Member[]; photos: Record<string, string>; me: Member | null };

export function TodoPanel({ householdId, members, photos, me }: Props) {
  const todos = useTodos(householdId);
  const [picked, setPicked] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const [editing, setEditing] = useState<TodoItem | null>(null);
  const [listSheet, setListSheet] = useState<{ list: TodoList | null } | null>(null);

  useEffect(() => setPicked(readPick()), []);
  const list = todos.lists.find((l) => l.id === picked) ?? todos.lists[0] ?? null;
  const today = isoDay(new Date());

  const { open, done } = useMemo(() => {
    const mine = todos.items.filter((i) => i.list_id === list?.id);
    const open = mine
      .filter((i) => !i.done)
      .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
    const done = mine.filter((i) => i.done).sort((a, b) => (b.done_at ?? "").localeCompare(a.done_at ?? ""));
    return { open, done };
  }, [todos.items, list?.id]);

  const openCount = (id: string) => todos.items.filter((i) => i.list_id === id && !i.done).length;
  const memberOf = (id: string | null) => members.find((m) => m.id === id);

  function pick(id: string) {
    setPicked(id);
    writePick(id);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!list || !text.trim()) return;
    const n = todos.addText(list.id, text, me?.id ?? null);
    setFlash(n === 0 ? "Already on the list" : null);
    setText("");
  }

  function startList(name: string, emoji: string) {
    const id = todos.addList(name, emoji);
    if (id) pick(id);
  }

  return (
    <section className="list todo" aria-label="To-do lists">
      <div className="list-head">
        <h2 className="panel-title">Lists</h2>
        {list && <span className="list-count">{open.length === 0 ? "All done" : `${open.length} to do`}</span>}
      </div>

      {todos.loaded && todos.lists.length === 0 ? (
        <div className="todo-start">
          <p className="fx-empty">Keep to-do lists for jobs, school and trips. Start with one of these, or make your own.</p>
          <div className="usuals">
            {STARTERS.map(([emoji, name]) => (
              <button key={name} className="chip" onClick={() => startList(name, emoji)}>{emoji} {name}</button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={() => setListSheet({ list: null })}>+ New list</button>
        </div>
      ) : (
        <>
          <div className="todo-lists" role="tablist" aria-label="Your lists">
            {todos.lists.map((l) => (
              <button key={l.id} role="tab" aria-selected={l.id === list?.id} className={`todo-tab${l.id === list?.id ? " is-on" : ""}`} onClick={() => pick(l.id)}>
                <span aria-hidden="true">{l.emoji ?? "✅"}</span> {l.name}
                {openCount(l.id) > 0 && <span className="todo-tab-n">{openCount(l.id)}</span>}
              </button>
            ))}
            <button className="todo-tab is-new" onClick={() => setListSheet({ list: null })} aria-label="New list">+ New</button>
          </div>

          {list && (
            <>
              <div className="todo-bar">
                <form className="add-bar" onSubmit={submit}>
                  <input
                    aria-label={`Add to ${list.name}`}
                    placeholder="Add things, separated by commas"
                    value={text}
                    onChange={(e) => { setText(e.target.value); setFlash(null); }}
                    enterKeyHint="done"
                    autoComplete="off"
                  />
                  <button className="btn btn-primary" disabled={!text.trim()}>Add</button>
                </form>
                <button className="icon-btn todo-more" onClick={() => setListSheet({ list })} aria-label={`Change or delete ${list.name}`} title="List settings">⋯</button>
              </div>
              {flash && <p className="flash" role="status">{flash}</p>}
              {todos.error && <p className="sync-note" role="alert">{todos.error}</p>}

              <div className="list-scroll">
                {open.length === 0 && done.length === 0 && <p className="empty">Nothing on this list yet.</p>}
                <ul className="todo-items">
                  {open.map((i) => (
                    <TodoRow key={i.id} item={i} who={memberOf(i.assignee)} photo={photos[i.assignee ?? ""]} today={today} onToggle={() => todos.toggle(i)} onEdit={() => setEditing(i)} />
                  ))}
                </ul>
                {done.length > 0 && (
                  <div className="aisle trolley">
                    <div className="trolley-head">
                      <h3 className="aisle-name">Done</h3>
                      <button className="btn btn-quiet btn-small" onClick={() => todos.clearDone(list.id)}>Clear done</button>
                    </div>
                    <ul className="todo-items">
                      {done.map((i) => (
                        <TodoRow key={i.id} item={i} who={memberOf(i.assignee)} photo={photos[i.assignee ?? ""]} today={today} onToggle={() => todos.toggle(i)} onEdit={() => setEditing(i)} />
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      <FeatureSheet open={editing !== null} title="Edit to-do" onClose={() => setEditing(null)}>
        {editing && (
          <EditTodo
            key={editing.id}
            item={editing}
            members={members}
            photos={photos}
            onSave={(patch) => { todos.updateItem(editing.id, patch); setEditing(null); }}
            onDelete={() => { todos.removeItem(editing.id); setEditing(null); }}
          />
        )}
      </FeatureSheet>

      <FeatureSheet open={listSheet !== null} title={listSheet?.list ? "Change list" : "New list"} onClose={() => setListSheet(null)}>
        {listSheet && (
          <EditList
            key={listSheet.list?.id ?? "new"}
            list={listSheet.list}
            count={listSheet.list ? todos.items.filter((i) => i.list_id === listSheet.list!.id).length : 0}
            onSave={(name, emoji) => {
              if (listSheet.list) todos.updateList(listSheet.list.id, { name, emoji });
              else startList(name, emoji);
              setListSheet(null);
            }}
            onDelete={() => {
              if (listSheet.list) todos.deleteList(listSheet.list.id);
              setListSheet(null);
            }}
          />
        )}
      </FeatureSheet>
    </section>
  );
}

function TodoRow({ item, who, photo, today, onToggle, onEdit }: { item: TodoItem; who?: Member; photo?: string; today: string; onToggle: () => void; onEdit: () => void }) {
  const due = item.due_date && !item.done ? dueLabel(item.due_date, today) : null;
  return (
    <li className={`item todo-item${item.done ? " is-checked" : ""}`}>
      <button className="todo-tick" onClick={onToggle} aria-pressed={item.done} aria-label={item.done ? `Mark ${item.title} as not done` : `Mark ${item.title} as done`}>
        <span className="tick" aria-hidden="true" style={{ borderColor: who?.colour }}>{item.done ? "✓" : ""}</span>
      </button>
      <button className="item-main todo-main" onClick={onEdit}>
        <span className="item-name">
          {item.title}
          {due && <span className={`todo-due ${due.tone}`}>{due.text}</span>}
        </span>
        {who && <span className="item-by" title={`For ${who.name}`}><Avatar member={who} size={28} photoUrl={photo} /></span>}
      </button>
    </li>
  );
}

function EditTodo({ item, members, photos, onSave, onDelete }: { item: TodoItem; members: Member[]; photos: Record<string, string>; onSave: (p: Partial<TodoItem>) => void; onDelete: () => void }) {
  const [title, setTitle] = useState(item.title);
  const [who, setWho] = useState<string | null>(item.assignee);
  const [due, setDue] = useState(item.due_date ?? "");
  const today = new Date();
  return (
    <form
      className="fx-stack"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ title: title.trim() || item.title, assignee: who, due_date: due || null });
      }}
    >
      <input className="title-input" aria-label="To-do" value={title} onChange={(e) => setTitle(e.target.value)} />
      <fieldset className="who-picker">
        <legend>Whose job?</legend>
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
      <div className="field-row">
        <label className="field">
          <span>Due (optional)</span>
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </label>
      </div>
      <div className="usuals fx-quick-dates">
        <button type="button" className="chip" onClick={() => setDue(isoDay(today))}>Today</button>
        <button type="button" className="chip" onClick={() => setDue(isoDay(addDays(today, 1)))}>Tomorrow</button>
        <button type="button" className="chip" onClick={() => setDue(isoDay(addDays(today, ((5 - today.getDay() + 7) % 7) || 7)))}>Friday</button>
        {due && <button type="button" className="chip" onClick={() => setDue("")}>No date</button>}
      </div>
      <div className="sheet-actions">
        <button type="button" className="btn btn-danger" onClick={onDelete}>Delete</button>
        <span className="spacer" />
        <button className="btn btn-primary btn-big">Save</button>
      </div>
    </form>
  );
}

function EditList({ list, count, onSave, onDelete }: { list: TodoList | null; count: number; onSave: (name: string, emoji: string) => void; onDelete: () => void }) {
  const [name, setName] = useState(list?.name ?? "");
  const [emoji, setEmoji] = useState(list?.emoji ?? "✅");
  return (
    <form
      className="fx-stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onSave(name.trim(), emoji);
      }}
    >
      <input className="title-input" aria-label="List name" placeholder="List name" value={name} onChange={(e) => setName(e.target.value)} autoFocus={!list} maxLength={80} />
      <div className="emoji-pick" role="radiogroup" aria-label="Picture">
        {EMOJIS.map((e) => (
          <button key={e} type="button" role="radio" aria-checked={emoji === e} className={`emoji-btn${emoji === e ? " is-on" : ""}`} onClick={() => setEmoji(e)}>
            {e}
          </button>
        ))}
      </div>
      <div className="sheet-actions">
        {list && (
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => confirm(count ? `Delete “${list.name}” and its ${count} ${count === 1 ? "thing" : "things"}?` : `Delete “${list.name}”?`) && onDelete()}
          >
            Delete list
          </button>
        )}
        <span className="spacer" />
        <button className="btn btn-primary btn-big" disabled={!name.trim()}>{list ? "Save" : "Make list"}</button>
      </div>
    </form>
  );
}
