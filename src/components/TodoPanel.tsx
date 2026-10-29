"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, fmt, fromIsoDay, isoDay } from "@/lib/dates";
import { patternFor, themeOf, THEMES } from "@/lib/listThemes";
import type { Member } from "@/lib/types";
import { useTodos, type TodoItem, type TodoList } from "@/lib/useTodos";
import { Avatar } from "./Avatar";
import { FeatureSheet } from "./FeatureSheet";

const EMOJIS = ["✅", "🏠", "🧹", "🛠️", "🎒", "🧳", "🎄", "🎂", "🐶", "🚗", "💼", "🌱", "📚", "💊", "🎁", "⭐"];
const STARTERS: [string, string][] = [["🏠", "Jobs around the house"], ["🎒", "School"], ["🧳", "Holiday packing"]];

export function dueLabel(due: string, today: string): { text: string; tone: "" | "is-soon" | "is-late" } {
  if (due < today) return { text: `Was due ${fmt(fromIsoDay(due), { day: "numeric", month: "short" })}`, tone: "is-late" };
  if (due === today) return { text: "Today", tone: "is-soon" };
  if (due === isoDay(addDays(fromIsoDay(today), 1))) return { text: "Tomorrow", tone: "is-soon" };
  const days = (fromIsoDay(due).getTime() - fromIsoDay(today).getTime()) / 864e5;
  return { text: fmt(fromIsoDay(due), days < 7 ? { weekday: "long" } : { weekday: "short", day: "numeric", month: "short" }), tone: "" };
}

type Props = { householdId: string; members: Member[]; photos: Record<string, string>; me: Member | null };
type Todos = ReturnType<typeof useTodos>;

// Lists as a board of cards: plain cards for grown-ups, themed sticker cards for the kids
export function TodoPanel({ householdId, members, photos, me }: Props) {
  const todos = useTodos(householdId);
  const [editing, setEditing] = useState<TodoItem | null>(null);
  const [listSheet, setListSheet] = useState<{ list: TodoList | null; kind?: "adult" | "kids" } | null>(null);
  const today = isoDay(new Date());

  // Cards are shared out into columns by hand: Safari mis-handles taps inside CSS columns
  const [cols, setCols] = useState(1);
  const boardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setCols(Math.max(1, Math.min(4, Math.floor((e.contentRect.width + 14) / 334)))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [todos.loaded, todos.lists.length]);
  const columns = Array.from({ length: cols }, (_, c) => todos.lists.filter((_, i) => i % cols === c));

  return (
    <section className="lists-board" aria-label="Lists">
      <header className="lb-head">
        <h2 className="panel-title">Lists</h2>
        <span className="spacer" />
        <button className="btn btn-soft" onClick={() => setListSheet({ list: null, kind: "kids" })}>🌈 Kids&apos; list</button>
        <button className="btn btn-primary" onClick={() => setListSheet({ list: null, kind: "adult" })}>+ New list</button>
      </header>
      {todos.error && <p className="sync-note" role="alert">{todos.error}</p>}

      {todos.loaded && todos.lists.length === 0 ? (
        <div className="lb-start">
          <button className="start-tile" onClick={() => setListSheet({ list: null, kind: "adult" })}>
            <span className="start-emoji" aria-hidden="true">📝</span>
            <strong>A grown-up list</strong>
            <span>Jobs, school things, trips. Simple and tidy, with who and when.</span>
          </button>
          <button className="start-tile is-kids" onClick={() => setListSheet({ list: null, kind: "kids" })}>
            <span className="start-emoji" aria-hidden="true">🎄</span>
            <strong>A kids&apos; list</strong>
            <span>Christmas lists, birthday wishes, holiday packing. Themes and stickers.</span>
          </button>
          <div className="usuals">
            {STARTERS.map(([emoji, name]) => (
              <button key={name} className="chip" onClick={() => todos.addList(name, emoji)}>{emoji} {name}</button>
            ))}
          </div>
        </div>
      ) : (
        <div className="board" ref={boardRef} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {columns.map((col, c) => (
            <div key={c} className="board-col">
              {col.map((l) =>
                l.kind === "kids" ? (
                  <KidsCard key={l.id} list={l} todos={todos} members={members} photos={photos} me={me} onSettings={() => setListSheet({ list: l })} />
                ) : (
                  <AdultCard key={l.id} list={l} todos={todos} members={members} photos={photos} me={me} today={today} onEdit={setEditing} onSettings={() => setListSheet({ list: l })} />
                ),
              )}
            </div>
          ))}
        </div>
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

      <FeatureSheet open={listSheet !== null} title={listSheet?.list ? "Change list" : listSheet?.kind === "kids" ? "New kids' list" : "New list"} onClose={() => setListSheet(null)}>
        {listSheet && (
          <EditList
            key={listSheet.list?.id ?? `new-${listSheet.kind}`}
            list={listSheet.list}
            startKind={listSheet.list?.kind ?? listSheet.kind ?? "adult"}
            members={members}
            photos={photos}
            count={listSheet.list ? todos.items.filter((i) => i.list_id === listSheet.list!.id).length : 0}
            onSave={(patch) => {
              if (listSheet.list) todos.updateList(listSheet.list.id, patch);
              else todos.addList(patch.name, patch.emoji, { kind: patch.kind, theme: patch.theme, owner: patch.owner });
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

function useListItems(todos: Todos, listId: string) {
  return useMemo(() => {
    const mine = todos.items.filter((i) => i.list_id === listId);
    const open = mine
      .filter((i) => !i.done)
      .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
    const done = mine.filter((i) => i.done).sort((a, b) => (b.done_at ?? "").localeCompare(a.done_at ?? ""));
    return { open, done };
  }, [todos.items, listId]);
}

function QuickAdd({ list, todos, me, big, placeholder, button }: { list: TodoList; todos: Todos; me: Member | null; big?: boolean; placeholder: string; button: string }) {
  const [text, setText] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  return (
    <>
      <form
        className={`add-bar card-add${big ? " is-big" : ""}`}
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          const n = todos.addText(list.id, text, me?.id ?? null);
          setFlash(n === 0 ? "That's already on the list" : null);
          setText("");
        }}
      >
        <input aria-label={`Add to ${list.name}`} placeholder={placeholder} value={text} onChange={(e) => { setText(e.target.value); setFlash(null); }} enterKeyHint="done" autoComplete="off" />
        <button className="btn btn-primary" disabled={!text.trim()}>{button}</button>
      </form>
      {flash && <p className="flash" role="status">{flash}</p>}
    </>
  );
}

// ---------- grown-up card ----------

function AdultCard({ list, todos, members, photos, me, today, onEdit, onSettings }: { list: TodoList; todos: Todos; members: Member[]; photos: Record<string, string>; me: Member | null; today: string; onEdit: (i: TodoItem) => void; onSettings: () => void }) {
  const { open, done } = useListItems(todos, list.id);
  const [showDone, setShowDone] = useState(false);
  const memberOf = (id: string | null) => members.find((m) => m.id === id);
  const total = open.length + done.length;

  return (
    <article className="lcard">
      <header className="lcard-head">
        <span className="lcard-emoji" aria-hidden="true">{list.emoji ?? "✅"}</span>
        <div className="lcard-title">
          <h3>{list.name}</h3>
          <span className="lcard-meta">{open.length === 0 ? (total ? "All done" : "Nothing yet") : `${open.length} to do`}{done.length ? ` · ${done.length} done` : ""}</span>
        </div>
        <button className="icon-btn lcard-more" onClick={onSettings} aria-label={`Change or delete ${list.name}`} title="List settings">⋯</button>
      </header>
      {total > 0 && <div className="lcard-progress" aria-hidden="true"><span style={{ width: `${(done.length / total) * 100}%` }} /></div>}
      <QuickAdd list={list} todos={todos} me={me} placeholder="Add things, separated by commas" button="Add" />
      <ul className="lcard-items">
        {open.map((i) => {
          const who = memberOf(i.assignee);
          const due = i.due_date ? dueLabel(i.due_date, today) : null;
          return (
            <li key={i.id} className="lrow">
              <button className="lrow-tick" onClick={() => todos.toggle(i)} aria-label={`Mark ${i.title} as done`}>
                <span className="tick" aria-hidden="true" style={{ borderColor: who?.colour }} />
              </button>
              <button className="lrow-main" onClick={() => onEdit(i)}>
                <span className="lrow-title">{i.title}</span>
                {due && <span className={`todo-due ${due.tone}`}>{due.text}</span>}
              </button>
              {who && <Avatar member={who} size={28} photoUrl={photos[who.id]} />}
            </li>
          );
        })}
      </ul>
      {done.length > 0 && (
        <div className="lcard-done">
          <button className="btn btn-quiet btn-small" onClick={() => setShowDone((s) => !s)}>{showDone ? "Hide" : "Show"} {done.length} done</button>
          <button className="btn btn-quiet btn-small" onClick={() => todos.clearDone(list.id)}>Clear done</button>
          {showDone && (
            <ul className="lcard-items is-done">
              {done.map((i) => (
                <li key={i.id} className="lrow is-done">
                  <button className="lrow-tick" onClick={() => todos.toggle(i)} aria-label={`Mark ${i.title} as not done`}>
                    <span className="tick" aria-hidden="true">✓</span>
                  </button>
                  <span className="lrow-title">{i.title}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </article>
  );
}

// ---------- kids' card ----------

function KidsCard({ list, todos, members, photos, me, onSettings }: { list: TodoList; todos: Todos; members: Member[]; photos: Record<string, string>; me: Member | null; onSettings: () => void }) {
  const theme = themeOf(list.theme);
  const { open, done } = useListItems(todos, list.id);
  const [tray, setTray] = useState<string | null>(null);
  const [cheer, setCheer] = useState<string | null>(null);
  const owner = members.find((m) => m.id === list.owner);
  const items = [...open, ...done];

  function tick(i: TodoItem) {
    if (!i.done) {
      setCheer(i.id);
      setTimeout(() => setCheer((c) => (c === i.id ? null : c)), 1100);
    }
    todos.toggle(i);
  }

  return (
    <article
      className="kcard"
      style={{
        ["--k-from" as string]: theme.from,
        ["--k-to" as string]: theme.to,
        ["--k-ink" as string]: theme.ink,
        ["--k-accent" as string]: theme.accent,
        backgroundImage: `${patternFor(theme)}, linear-gradient(150deg, ${theme.from}, ${theme.to})`,
      }}
    >
      <header className="kcard-head">
        {owner ? <Avatar member={owner} size={64} photoUrl={photos[owner.id]} ring /> : <span className="kcard-badge" aria-hidden="true">{theme.emoji}</span>}
        <div className="kcard-title">
          <h3>{list.name}</h3>
          <span className="kcard-meta">
            {items.length === 0 ? "Add your first thing!" : done.length === items.length ? "All done! ⭐" : `${done.length} of ${items.length} done`}
          </span>
        </div>
        <span className="kcard-theme" aria-hidden="true">{theme.emoji}</span>
        <button className="icon-btn kcard-more" onClick={onSettings} aria-label={`Change or delete ${list.name}`} title="List settings">⋯</button>
      </header>

      {items.length > 0 && (
        <div className="kcard-stars" aria-label={`${done.length} stars`}>
          {items.map((i) => <span key={i.id} className={i.done ? "is-on" : ""}>★</span>)}
        </div>
      )}

      <QuickAdd list={list} todos={todos} me={me} big placeholder="What shall we add?" button="Add!" />

      <ul className="kcard-items">
        {items.map((i) => (
          <li key={i.id} className={`kitem${i.done ? " is-done" : ""}${cheer === i.id ? " is-cheer" : ""}`}>
            <div className="kitem-row">
              <button className={`kitem-sticker${i.sticker ? "" : " is-empty"}`} onClick={() => setTray((t) => (t === i.id ? null : i.id))} aria-label={i.sticker ? `Change sticker for ${i.title}` : `Add a sticker to ${i.title}`}>
                {i.sticker ?? "＋"}
              </button>
              <span className="kitem-title">{i.title}</span>
              <button className="kitem-tick" onClick={() => tick(i)} aria-pressed={i.done} aria-label={i.done ? `Not done yet: ${i.title}` : `Done: ${i.title}`}>
                {i.done ? "⭐" : ""}
              </button>
              {cheer === i.id && (
                <span className="burst" aria-hidden="true">
                  {theme.stickers.slice(0, 8).map((s, n) => <span key={n} style={{ ["--a" as string]: `${n * 45}deg` }}>{s}</span>)}
                </span>
              )}
            </div>
            {tray === i.id && (
              <div className="sticker-tray" role="group" aria-label="Pick a sticker">
                {theme.stickers.map((s) => (
                  <button key={s} className={i.sticker === s ? "is-on" : ""} onClick={() => { todos.updateItem(i.id, { sticker: s }); setTray(null); }}>{s}</button>
                ))}
                {i.sticker && <button className="tray-none" onClick={() => { todos.updateItem(i.id, { sticker: null }); setTray(null); }}>None</button>}
                <button className="tray-none" onClick={() => { todos.removeItem(i.id); setTray(null); }}>🗑 Remove</button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {done.length > 0 && done.length === items.length && (
        <button className="btn btn-small kcard-clear" onClick={() => todos.clearDone(list.id)}>Start again</button>
      )}
    </article>
  );
}

// ---------- sheets ----------

function EditTodo({ item, members, photos, onSave, onDelete }: { item: TodoItem; members: Member[]; photos: Record<string, string>; onSave: (p: Partial<TodoItem>) => void; onDelete: () => void }) {
  const [title, setTitle] = useState(item.title);
  const [who, setWho] = useState<string | null>(item.assignee);
  const [due, setDue] = useState(item.due_date ?? "");
  const today = new Date();
  return (
    <form className="fx-stack" onSubmit={(e) => { e.preventDefault(); onSave({ title: title.trim() || item.title, assignee: who, due_date: due || null }); }}>
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
      <label className="field">
        <span>Due (optional)</span>
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
      </label>
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

type ListPatch = { name: string; emoji: string; kind: "adult" | "kids"; theme: string | null; owner: string | null };

function EditList({ list, startKind, members, photos, count, onSave, onDelete }: { list: TodoList | null; startKind: "adult" | "kids"; members: Member[]; photos: Record<string, string>; count: number; onSave: (p: ListPatch) => void; onDelete: () => void }) {
  const kind = startKind;
  const [emoji, setEmoji] = useState(list?.emoji ?? "✅");
  const [theme, setTheme] = useState(list?.theme ?? "christmas");
  const kids = members.filter((m) => m.role === "child");
  const [owner, setOwner] = useState<string | null>(list?.owner ?? (startKind === "kids" ? kids[0]?.id ?? null : null));
  const suggest = (o: string | null, t: string) => {
    const name = members.find((m) => m.id === o)?.name;
    const s = themeOf(t).suggested;
    // Keep proper nouns like Christmas capitalised
    const rest = /^(Christmas|Space)/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1);
    return name ? `${name}'s ${rest}` : s;
  };
  const [name, setName] = useState(list?.name ?? (startKind === "kids" ? suggest(owner, theme) : ""));
  const [touched, setTouched] = useState(Boolean(list));
  const rename = (o: string | null, t: string) => !touched && setName(suggest(o, t));

  return (
    <form
      className="fx-stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSave({ name: name.trim(), emoji: kind === "kids" ? themeOf(theme).emoji : emoji, kind, theme: kind === "kids" ? theme : null, owner: kind === "kids" ? owner : null });
      }}
    >
      {kind === "kids" && (
        <>
          <fieldset className="who-picker">
            <legend>Whose list?</legend>
            {members.map((m) => (
              <button key={m.id} type="button" className={`who-pick${owner === m.id ? " is-on" : ""}`} style={{ ["--c" as string]: m.colour }} aria-pressed={owner === m.id} onClick={() => { setOwner(m.id); rename(m.id, theme); }}>
                <Avatar member={m} size={40} photoUrl={photos[m.id]} />
                {m.name}
              </button>
            ))}
          </fieldset>
          <div className="theme-pick" role="radiogroup" aria-label="Theme">
            {THEMES.map((t) => (
              <button
                key={t.key}
                type="button"
                role="radio"
                aria-checked={theme === t.key}
                className={`theme-tile${theme === t.key ? " is-on" : ""}`}
                style={{ backgroundImage: `${patternFor(t)}, linear-gradient(150deg, ${t.from}, ${t.to})`, color: t.ink }}
                onClick={() => { setTheme(t.key); rename(owner, t.key); }}
              >
                <span className="theme-emoji" aria-hidden="true">{t.emoji}</span>
                {t.label}
              </button>
            ))}
          </div>
        </>
      )}

      <input className="title-input" aria-label="List name" placeholder="List name" value={name} onChange={(e) => { setName(e.target.value); setTouched(true); }} maxLength={80} />

      {kind === "adult" && (
        <div className="emoji-pick" role="radiogroup" aria-label="Picture">
          {EMOJIS.map((e) => (
            <button key={e} type="button" role="radio" aria-checked={emoji === e} className={`emoji-btn${emoji === e ? " is-on" : ""}`} onClick={() => setEmoji(e)}>{e}</button>
          ))}
        </div>
      )}

      <div className="sheet-actions">
        {list && (
          <button type="button" className="btn btn-danger" onClick={() => confirm(count ? `Delete “${list.name}” and its ${count} ${count === 1 ? "thing" : "things"}?` : `Delete “${list.name}”?`) && onDelete()}>
            Delete list
          </button>
        )}
        <span className="spacer" />
        <button className="btn btn-primary btn-big" disabled={!name.trim()}>{list ? "Save" : "Make list"}</button>
      </div>
    </form>
  );
}
