"use client";

import { useEffect, useRef, useState } from "react";
import { fromIsoDay, hhmm, isoDay } from "@/lib/dates";
import { formatRule, parseRule, type Freq } from "@/lib/recurrence";
import type { EventDraft } from "@/lib/useHousehold";
import type { Member, Occurrence } from "@/lib/types";
import { Avatar } from "./Avatar";

export type SheetRequest =
  | { kind: "new"; date: Date; hour?: number }
  | { kind: "edit"; occurrence: Occurrence };

type Repeat = "none" | "daily" | "weekly" | "fortnightly" | "monthly" | "yearly";
const REPEATS: [Repeat, string][] = [
  ["none", "Doesn't repeat"],
  ["daily", "Every day"],
  ["weekly", "Every week"],
  ["fortnightly", "Every 2 weeks"],
  ["monthly", "Every month"],
  ["yearly", "Every year"],
];
const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type Props = {
  request: SheetRequest | null;
  members: Member[];
  photos: Record<string, string>;
  onClose: () => void;
  onSave: (d: EventDraft) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSkip: (o: Occurrence) => Promise<void>;
};

export function EventSheet({ request, members, photos, onClose, onSave, onDelete, onSkip }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (request) dialog.current?.showModal();
    else dialog.current?.close();
  }, [request]);

  return (
    <dialog ref={dialog} className="sheet event-sheet" onClose={onClose}>
      {request && (
        <EventForm
          key={request.kind === "edit" ? request.occurrence.key : `new-${request.date.getTime()}-${request.hour}`}
          request={request}
          members={members}
          photos={photos}
          onCancel={() => dialog.current?.close()}
          onSave={onSave}
          onDelete={onDelete}
          onSkip={onSkip}
        />
      )}
    </dialog>
  );
}

function EventForm({ request, members, photos, onCancel, onSave, onDelete, onSkip }: Omit<Props, "request" | "onClose"> & { request: SheetRequest; onCancel: () => void }) {
  const editing = request.kind === "edit" ? request.occurrence : null;
  const ev = editing?.event;
  const rule = parseRule(ev?.rrule ?? null);
  // A repeating event is edited from its first date, so the whole series moves together
  const seriesStart = ev ? new Date(ev.starts_at) : null;
  const seriesEnd = ev?.ends_at ? new Date(ev.ends_at) : seriesStart;
  const baseDate = request.kind === "new" ? request.date : seriesStart!;
  const baseHour = request.kind === "new" ? request.hour : undefined;

  const [title, setTitle] = useState(ev?.title ?? "");
  const [who, setWho] = useState<string[]>(editing?.memberIds ?? []);
  const [date, setDate] = useState(isoDay(baseDate));
  const [allDay, setAllDay] = useState(ev ? ev.all_day : baseHour === undefined);
  const [start, setStart] = useState(ev && !ev.all_day ? hhmm(seriesStart!) : `${String(baseHour ?? 9).padStart(2, "0")}:00`);
  const [end, setEnd] = useState(ev && !ev.all_day && seriesEnd ? hhmm(seriesEnd) : `${String(Math.min((baseHour ?? 9) + 1, 23)).padStart(2, "0")}:00`);
  const [endDate, setEndDate] = useState(ev?.all_day && seriesEnd ? isoDay(seriesEnd) : isoDay(baseDate));
  const [repeat, setRepeat] = useState<Repeat>(
    !rule ? "none" : rule.freq === "DAILY" ? "daily" : rule.freq === "WEEKLY" ? (rule.interval === 2 ? "fortnightly" : "weekly") : rule.freq === "MONTHLY" ? "monthly" : "yearly",
  );
  const weekdayOf = (iso: string) => (fromIsoDay(iso).getDay() + 6) % 7;
  const [byDay, setByDay] = useState<number[]>(rule?.byDay.length ? rule.byDay : [weekdayOf(isoDay(baseDate))]);
  const [until, setUntil] = useState(rule?.until ?? "");
  const [location, setLocation] = useState(ev?.location ?? "");
  const [notes, setNotes] = useState(ev?.notes ?? "");
  const [more, setMore] = useState(Boolean(ev?.location || ev?.notes));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const everyone = who.length === 0 || who.length === members.length;

  // Starts as everyone. Tapping a face while everyone is on picks just that person;
  // further taps add or remove people, and removing the last one goes back to everyone.
  function toggleWho(id: string) {
    setWho((w) => {
      if (w.length === 0 || w.length === members.length) return [id];
      const next = w.includes(id) ? w.filter((x) => x !== id) : [...w, id];
      return next.length === members.length ? [] : next;
    });
  }

  function changeDate(iso: string) {
    setDate(iso);
    if (endDate < iso) setEndDate(iso);
    if ((repeat === "weekly" || repeat === "fortnightly") && byDay.length === 1) setByDay([weekdayOf(iso)]);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const startDate = allDay ? fromIsoDay(date) : fromIsoDay(date, sh, sm);
    let endAt = allDay ? fromIsoDay(endDate < date ? date : endDate) : fromIsoDay(date, eh, em);
    if (!allDay && endAt <= startDate) endAt = new Date(startDate.getTime() + 60 * 60 * 1000);

    let rrule: string | null = null;
    if (repeat !== "none") {
      const freq: Freq = repeat === "daily" ? "DAILY" : repeat === "monthly" ? "MONTHLY" : repeat === "yearly" ? "YEARLY" : "WEEKLY";
      rrule = formatRule({
        freq,
        interval: repeat === "fortnightly" ? 2 : 1,
        byDay: freq === "WEEKLY" ? [...byDay].sort() : [],
        until: until || null,
        exDates: rule?.exDates ?? [],
      });
    }

    setBusy(true);
    setError(null);
    try {
      await onSave({
        id: ev?.id,
        title,
        starts_at: startDate.toISOString(),
        ends_at: endAt.toISOString(),
        all_day: allDay,
        rrule,
        location: location.trim() || null,
        notes: notes.trim() || null,
        memberIds: everyone ? [] : who,
      });
      onCancel();
    } catch {
      setError("That didn't save. Check the connection and try again.");
      setBusy(false);
    }
  }

  async function remove(all: boolean) {
    if (!editing) return;
    setBusy(true);
    if (all || !rule) await onDelete(editing.event.id);
    else await onSkip(editing);
    onCancel();
  }

  return (
    <form className="sheet-form" onSubmit={save}>
      <div className="sheet-top">
        <h2 className="sheet-title">{editing ? "Edit event" : "New event"}</h2>
        <button type="button" className="icon-btn" onClick={onCancel} aria-label="Close">✕</button>
      </div>

      <input
        className="title-input"
        aria-label="What's happening?"
        placeholder="What's happening?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus={!editing}
        required
      />

      <fieldset className="who-picker">
        <legend>Who&apos;s going? <span className="legend-hint">{everyone ? "Everyone. Tap a face to pick just them." : "Tap faces to add or remove."}</span></legend>
        <button type="button" className={`who-pick everyone${everyone ? " is-on" : ""}`} onClick={() => setWho([])} aria-pressed={everyone}>
          <span className="everyone-badge" aria-hidden="true">★</span>
          Everyone
        </button>
        {members.map((m) => {
          const on = everyone || who.includes(m.id);
          return (
            <button
              key={m.id}
              type="button"
              className={`who-pick${on ? " is-on" : ""}`}
              style={{ ["--c" as string]: m.colour }}
              onClick={() => toggleWho(m.id)}
              aria-pressed={on}
            >
              <Avatar member={m} size={40} photoUrl={photos[m.id]} />
              {m.name}
            </button>
          );
        })}
      </fieldset>

      <div className="field-row">
        <label className="field">
          <span>Day</span>
          <input type="date" value={date} onChange={(e) => changeDate(e.target.value)} required />
        </label>
        <label className="switch">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
          <span>All day</span>
        </label>
      </div>

      {allDay ? (
        <label className="field">
          <span>Last day (for trips and holidays)</span>
          <input type="date" value={endDate} min={date} onChange={(e) => setEndDate(e.target.value)} />
        </label>
      ) : (
        <div className="field-row">
          <label className="field">
            <span>Starts</span>
            <input type="time" value={start} step={300} onChange={(e) => setStart(e.target.value)} required />
          </label>
          <label className="field">
            <span>Ends</span>
            <input type="time" value={end} step={300} onChange={(e) => setEnd(e.target.value)} required />
          </label>
        </div>
      )}

      <label className="field">
        <span>Repeats</span>
        <select value={repeat} onChange={(e) => setRepeat(e.target.value as Repeat)}>
          {REPEATS.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </label>

      {(repeat === "weekly" || repeat === "fortnightly") && (
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

      {repeat !== "none" && (
        <label className="field">
          <span>Stop repeating after (optional)</span>
          <input type="date" value={until} min={date} onChange={(e) => setUntil(e.target.value)} />
        </label>
      )}

      {more ? (
        <>
          <label className="field">
            <span>Where</span>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Leisure centre" />
          </label>
          <label className="field">
            <span>Notes</span>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Bring swimming kit" />
          </label>
        </>
      ) : (
        <button type="button" className="btn btn-quiet btn-left" onClick={() => setMore(true)}>+ Add place or notes</button>
      )}

      {editing && rule && <p className="sheet-hint">Changes apply to every repeat of this event.</p>}
      {error && <p className="login-error" role="alert">{error}</p>}

      <div className="sheet-actions">
        {editing && (
          <div className="delete-group">
            {rule ? (
              <>
                <button type="button" className="btn btn-danger" disabled={busy} onClick={() => remove(false)}>
                  Delete {editing.start.toLocaleDateString("en-GB", { weekday: "short", day: "numeric" })} only
                </button>
                <button type="button" className="btn btn-danger" disabled={busy} onClick={() => remove(true)}>Delete all</button>
              </>
            ) : (
              <button type="button" className="btn btn-danger" disabled={busy} onClick={() => remove(true)}>Delete</button>
            )}
          </div>
        )}
        <span className="spacer" />
        <button className="btn btn-primary btn-big" disabled={busy || !title.trim()}>
          {busy ? "Saving…" : editing ? "Save" : "Add event"}
        </button>
      </div>
    </form>
  );
}
