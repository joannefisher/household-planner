"use client";

import { useState } from "react";
import { fmt, isoDay, nextSevenDays, timeOf } from "@/lib/dates";
import { describe, type Weather } from "@/lib/weather";
import type { Dinner, Member, PlannerEvent } from "@/lib/types";

type Props = {
  events: PlannerEvent[];
  dinners: Dinner[];
  members: Member[];
  weather: Weather | null;
  onDinner: (date: string, note: string) => void;
};

function eventsOn(iso: string, events: PlannerEvent[]) {
  return events
    .filter((e) => {
      const start = isoDay(new Date(e.starts_at));
      const end = e.ends_at ? isoDay(new Date(e.ends_at)) : start;
      return start <= iso && iso <= end;
    })
    .sort((a, b) => Number(b.all_day) - Number(a.all_day) || a.starts_at.localeCompare(b.starts_at));
}

export function Week({ events, dinners, members, weather, onDinner }: Props) {
  const days = nextSevenDays();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  return (
    <section className="week" aria-label="Next 7 days">
      {days.map(({ iso, date }, i) => {
        const dayEvents = eventsOn(iso, events);
        const dinner = dinners.find((d) => d.date === iso);
        const dinnerText = dinner?.recipes?.title ?? dinner?.note ?? null;
        const w = weather?.days.find((d) => d.date === iso);
        return (
          <article key={iso} className={`day${i === 0 ? " is-today" : ""}`}>
            <header className="day-head">
              <span className="day-name">{fmt(date, { weekday: "short" })}</span>
              <span className="day-date">{fmt(date, { day: "numeric" })}</span>
              {w && (
                <span className="day-weather" title={describe(w.code).label}>
                  <span aria-hidden="true">{describe(w.code).icon}</span> {w.max}°<span className="muted">/{w.min}°</span>
                </span>
              )}
            </header>

            <ul className="events">
              {dayEvents.length === 0 && <li className="nothing">Nothing on</li>}
              {dayEvents.map((e) => {
                const who = members.filter((m) => e.event_members.some((em) => em.member_id === m.id));
                const family = who.length === 0 || who.length === members.length;
                return (
                  <li key={e.id} className="event" style={{ ["--who" as string]: family ? "var(--muted)" : who[0]?.colour }}>
                    <span className="event-time">{e.all_day ? "All day" : timeOf(e.starts_at)}</span>
                    <span className="event-title">{e.title}</span>
                    <span className="event-who">
                      {family ? "Everyone" : who.map((m) => m.name).join(", ")}
                    </span>
                  </li>
                );
              })}
            </ul>

            <footer className="dinner">
              <span className="dinner-label">Dinner</span>
              {editing === iso ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    onDinner(iso, draft);
                    setEditing(null);
                  }}
                >
                  <input
                    autoFocus
                    aria-label={`Dinner for ${fmt(date, { weekday: "long" })}`}
                    value={draft}
                    placeholder="Lasagne, leftovers…"
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => {
                      onDinner(iso, draft);
                      setEditing(null);
                    }}
                  />
                </form>
              ) : (
                <button
                  className={`dinner-value${dinnerText ? "" : " is-empty"}`}
                  onClick={() => {
                    setDraft(dinnerText ?? "");
                    setEditing(iso);
                  }}
                >
                  {dinnerText ?? "Add dinner"}
                </button>
              )}
            </footer>
          </article>
        );
      })}
    </section>
  );
}
