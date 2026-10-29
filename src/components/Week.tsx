"use client";

import { useMemo, useState } from "react";
import { fmt, hhmm, isoDay, minutesOfDay } from "@/lib/dates";
import { describeRule, parseRule } from "@/lib/recurrence";
import { describe, type Weather } from "@/lib/weather";
import type { Dinner, Member, Occurrence } from "@/lib/types";
import { Avatar } from "./Avatar";
import type { SheetRequest } from "./EventSheet";

type Day = { iso: string; date: Date };

type Props = {
  days: Day[];
  occurrences: Occurrence[];
  dinners: Dinner[];
  members: Member[];
  photos: Record<string, string>;
  weather: Weather | null;
  hidden: string[];
  now: Date;
  onOpen: (r: SheetRequest) => void;
  onDinner: (date: string, note: string) => void;
  onDinnerOpen?: (date: string) => void;
};

// ---------- shared bits ----------

function whoOf(o: Occurrence, members: Member[]) {
  const who = members.filter((m) => o.memberIds.includes(m.id));
  const everyone = who.length === 0 || who.length === members.length;
  return { who: everyone ? [] : who, everyone, colour: everyone ? "var(--everyone)" : who[0].colour };
}

// People switched off in the header have their events hidden; family events always show
function shown(o: Occurrence, hidden: string[], members: Member[]) {
  if (!hidden.length) return true;
  const { everyone } = whoOf(o, members);
  return everyone || o.memberIds.some((id) => !hidden.includes(id));
}

function onDay(o: Occurrence, iso: string) {
  return isoDay(o.start) <= iso && iso <= isoDay(o.end);
}

function Faces({ who, photos, size }: { who: Member[]; photos: Record<string, string>; size: number }) {
  return (
    <span className="faces">
      {who.map((m) => (
        <Avatar key={m.id} member={m} size={size} photoUrl={photos[m.id]} ring />
      ))}
    </span>
  );
}

function DinnerCell({ iso, dinner, onDinner, onOpen, label }: { iso: string; dinner?: Dinner; onDinner: Props["onDinner"]; onOpen?: Props["onDinnerOpen"]; label: string }) {
  const text = dinner?.recipes?.title ?? dinner?.note ?? null;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  if (editing) {
    const done = () => {
      onDinner(iso, draft);
      setEditing(false);
    };
    return (
      <form className="dinner-edit" onSubmit={(e) => { e.preventDefault(); done(); }}>
        <input autoFocus aria-label={`Dinner for ${label}`} value={draft} placeholder="Lasagne…" onChange={(e) => setDraft(e.target.value)} onBlur={done} />
        {onOpen && (
          <button type="button" className="dinner-recipes" onMouseDown={(e) => e.preventDefault()} onPointerDown={(e) => e.preventDefault()} onClick={() => { setEditing(false); onOpen(iso); }} aria-label={`Pick a recipe for ${label}`} title="Recipes">📖</button>
        )}
      </form>
    );
  }
  return (
    <button className={`dinner-btn${text ? "" : " is-empty"}`} onClick={() => { if (dinner?.recipe_id && onOpen) return onOpen(iso); setDraft(text ?? ""); setEditing(true); }}>
      {text ?? "+ Dinner"}
    </button>
  );
}

// ---------- kitchen: week with time slots ----------

type Placed = { o: Occurrence; top: number; height: number; col: number; cols: number };

function layoutDay(items: Occurrence[], iso: string, startMin: number, endMin: number): Placed[] {
  const span = endMin - startMin;
  const timed = items
    .map((o) => {
      const s = isoDay(o.start) < iso ? 0 : minutesOfDay(o.start);
      const e = isoDay(o.end) > iso ? 24 * 60 : Math.max(minutesOfDay(o.end), s + 30);
      return { o, s: Math.max(s, startMin), e: Math.min(Math.max(e, s + 30), endMin) };
    })
    .sort((a, b) => a.s - b.s || b.e - a.e);

  // Events that overlap share the column width side by side
  const placed: Placed[] = [];
  let cluster: typeof timed = [];
  let clusterEnd = -1;
  const flush = () => {
    const colEnds: number[] = [];
    const cols = cluster.map((t) => {
      let c = colEnds.findIndex((end) => end <= t.s);
      if (c === -1) c = colEnds.push(0) - 1;
      colEnds[c] = t.e;
      return c;
    });
    cluster.forEach((t, i) =>
      placed.push({ o: t.o, top: ((t.s - startMin) / span) * 100, height: ((t.e - t.s) / span) * 100, col: cols[i], cols: colEnds.length }),
    );
    cluster = [];
  };
  for (const t of timed) {
    if (t.s >= clusterEnd && cluster.length) flush();
    cluster.push(t);
    clusterEnd = Math.max(clusterEnd, t.e);
  }
  if (cluster.length) flush();
  return placed;
}

export function WeekGrid({ days, occurrences: all, dinners, members, photos, weather, hidden, now, onOpen, onDinner, onDinnerOpen }: Props) {
  const occurrences = all.filter((o) => shown(o, hidden, members));
  const allDay = occurrences.filter((o) => o.event.all_day);
  const timed = occurrences.filter((o) => !o.event.all_day);

  // Show 7am–10pm, stretched to fit anything earlier or later this week
  const [startHour, endHour] = useMemo(() => {
    let s = 7;
    let e = 22;
    for (const o of timed) {
      s = Math.min(s, o.start.getHours());
      e = Math.max(e, Math.min(24, o.end.getHours() + (o.end.getMinutes() ? 1 : 0)));
    }
    return [s, e];
  }, [timed]);
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const todayIso = isoDay(now);
  const nowMin = minutesOfDay(now);
  const span = (endHour - startHour) * 60;

  return (
    <section className="gw" aria-label="Week" style={{ ["--hours" as string]: hours.length }}>
      <div className="gw-row gw-head">
        <div className="gw-gutter" />
        {days.map(({ iso, date }) => {
          const w = weather?.days.find((d) => d.date === iso);
          return (
            <div key={iso} className={`gw-day-head${iso === todayIso ? " is-today" : ""}`}>
              <span className="gw-dow">{fmt(date, { weekday: "short" })}</span>
              <span className="gw-num">{date.getDate()}</span>
              {w && (
                <span className="gw-wx" title={describe(w.code).label}>
                  <span aria-hidden="true">{describe(w.code).icon}</span> {w.max}°
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="gw-row gw-allday">
        <div className="gw-gutter gw-label">All day</div>
        {days.map(({ iso, date }) => (
          <div key={iso} className={`gw-allday-cell${iso === todayIso ? " is-today" : ""}`} onClick={(e) => e.target === e.currentTarget && onOpen({ kind: "new", date })}>
            {allDay.filter((o) => onDay(o, iso)).map((o) => {
              const { who, colour } = whoOf(o, members);
              return (
                <button key={o.key} className="pill" style={{ ["--c" as string]: colour }} onClick={() => onOpen({ kind: "edit", occurrence: o })}>
                  <span className="pill-title">{o.event.title}</span>
                  <Faces who={who} photos={photos} size={18} />
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="gw-row gw-body">
        <div className="gw-gutter gw-times">
          {hours.map((h) => (
            <span key={h} className="gw-hour" style={{ top: `${((h - startHour) / hours.length) * 100}%` }}>
              {String(h).padStart(2, "0")}:00
            </span>
          ))}
        </div>
        {days.map(({ iso, date }) => (
          <div
            key={iso}
            className={`gw-col${iso === todayIso ? " is-today" : ""}`}
            onClick={(e) => {
              if (e.target !== e.currentTarget) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const hour = startHour + Math.floor(((e.clientY - rect.top) / rect.height) * hours.length);
              onOpen({ kind: "new", date, hour });
            }}
          >
            {layoutDay(timed.filter((o) => onDay(o, iso)), iso, startHour * 60, endHour * 60).map(({ o, top, height, col, cols }) => {
              const { who, colour } = whoOf(o, members);
              const short = o.end.getTime() - o.start.getTime() < 80 * 60 * 1000;
              return (
                <button
                  key={o.key}
                  className={`block${short ? " is-short" : ""}`}
                  style={{ top: `${top}%`, height: `${height}%`, left: `calc(${(col / cols) * 100}% + 2px)`, width: `calc(${100 / cols}% - 4px)`, ["--c" as string]: colour }}
                  onClick={() => onOpen({ kind: "edit", occurrence: o })}
                >
                  {who.length > 0 && <Faces who={who} photos={photos} size={short ? 16 : 22} />}
                  <span className="block-text">
                    <span className="block-title">{o.event.title}</span>
                    {!short && <span className="block-time">{hhmm(o.start)}–{hhmm(o.end)}{o.event.rrule ? " ↻" : ""}</span>}
                  </span>
                </button>
              );
            })}
            {iso === todayIso && nowMin >= startHour * 60 && nowMin <= endHour * 60 && (
              <span className="now-line" style={{ top: `${((nowMin - startHour * 60) / span) * 100}%` }} aria-hidden="true" />
            )}
          </div>
        ))}
      </div>

      <div className="gw-row gw-dinner">
        <div className="gw-gutter gw-label">Dinner</div>
        {days.map(({ iso, date }) => (
          <div key={iso} className={`gw-dinner-cell${iso === todayIso ? " is-today" : ""}`}>
            <DinnerCell iso={iso} dinner={dinners.find((d) => d.date === iso)} onDinner={onDinner} onOpen={onDinnerOpen} label={fmt(date, { weekday: "long" })} />
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------- phones: the week as a list of days ----------

export function Agenda({ days, occurrences: all, dinners, members, photos, weather, hidden, now, onOpen, onDinner, onDinnerOpen }: Props) {
  const occurrences = all.filter((o) => shown(o, hidden, members));
  const todayIso = isoDay(now);
  return (
    <section className="agenda" aria-label="Week">
      {days.map(({ iso, date }) => {
        const items = occurrences.filter((o) => onDay(o, iso));
        const w = weather?.days.find((d) => d.date === iso);
        const past = iso < todayIso;
        return (
          <article key={iso} className={`ag-day${iso === todayIso ? " is-today" : ""}${past ? " is-past" : ""}`}>
            <header className="ag-head">
              <span className="ag-date">
                <span className="ag-num">{date.getDate()}</span>
                <span className="ag-dow">{iso === todayIso ? "Today" : fmt(date, { weekday: "long" })}</span>
              </span>
              {w && <span className="ag-wx"><span aria-hidden="true">{describe(w.code).icon}</span> {w.max}°/{w.min}°</span>}
              <button className="ag-add" onClick={() => onOpen({ kind: "new", date, hour: 9 })} aria-label={`Add an event on ${fmt(date, { weekday: "long" })}`}>+</button>
            </header>
            <ul className="ag-list">
              {items.length === 0 && <li className="ag-empty">Nothing planned</li>}
              {items.map((o) => {
                const { who, colour } = whoOf(o, members);
                return (
                  <li key={o.key}>
                    <button className="ag-item" style={{ ["--c" as string]: colour }} onClick={() => onOpen({ kind: "edit", occurrence: o })}>
                      <span className="ag-time">{o.event.all_day ? "All day" : hhmm(o.start)}</span>
                      <span className="ag-title">
                        {o.event.title}
                        {o.event.rrule && <span className="ag-repeat">{describeRule(parseRule(o.event.rrule))}</span>}
                      </span>
                      {who.length > 0 ? <Faces who={who} photos={photos} size={28} /> : <span className="ag-everyone">Everyone</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
            <footer className="ag-dinner">
              <span className="ag-dinner-label" aria-hidden="true">🍽</span>
              <DinnerCell iso={iso} dinner={dinners.find((d) => d.date === iso)} onDinner={onDinner} onOpen={onDinnerOpen} label={fmt(date, { weekday: "long" })} />
            </footer>
          </article>
        );
      })}
    </section>
  );
}
