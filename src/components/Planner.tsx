"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { addDays, fmt, startOfWeek, weekLabel } from "@/lib/dates";
import { describe, fetchWeather, type Weather } from "@/lib/weather";
import { useHousehold, useWeek } from "@/lib/useHousehold";
import { useShoppingList } from "@/lib/useShoppingList";
import { Avatar } from "./Avatar";
import { EventSheet, type SheetRequest } from "./EventSheet";
import { FamilySheet } from "./FamilySheet";
import { SettingsExtras } from "./SettingsExtras";
import { ShoppingList } from "./ShoppingList";
import { Agenda, WeekGrid } from "./Week";

const ADDER_KEY = "planner.addingAs";
const HIDDEN_KEY = "planner.hiddenPeople";

function readStore<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeStore(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function useNow(intervalMs: number) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function useWide() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px)");
    const set = () => setWide(mq.matches);
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);
  return wide;
}

function useWeather(lat?: number | null, lon?: number | null) {
  const [weather, setWeather] = useState<Weather | null>(null);
  useEffect(() => {
    if (lat == null || lon == null) return;
    const load = () => fetchWeather(lat, lon).then(setWeather).catch(() => {});
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [lat, lon]);
  return weather;
}

export function Planner() {
  const hh = useHousehold();
  const { household, members, me, photos } = hh;
  const now = useNow(1000);
  const wide = useWide();
  const [weekOffset, setWeekOffset] = useState(0);
  const today = now ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) : null;
  const weekStart = useMemo(() => addDays(startOfWeek(today ?? new Date()), weekOffset * 7), [today?.getTime(), weekOffset]); // eslint-disable-line react-hooks/exhaustive-deps
  const week = useWeek(household?.id ?? null, weekStart);
  const list = useShoppingList(household?.id ?? null);
  const weather = useWeather(household?.latitude, household?.longitude);

  const [tab, setTab] = useState<"week" | "list">("week");
  const [sheet, setSheet] = useState<SheetRequest | null>(null);
  const [familyOpen, setFamilyOpen] = useState(false);
  const [hidden, setHidden] = useState<string[]>([]);
  const [addingAs, setAddingAs] = useState<string | null>(null);

  useEffect(() => setHidden(readStore<string[]>(HIDDEN_KEY, [])), []);
  useEffect(() => {
    if (!me) return;
    const saved = readStore<string | null>(ADDER_KEY, null);
    setAddingAs(saved && members.some((m) => m.id === saved) ? saved : me.id);
  }, [me, members]);

  function togglePerson(id: string) {
    setHidden((h) => {
      const next = h.includes(id) ? h.filter((x) => x !== id) : [...h, id];
      writeStore(HIDDEN_KEY, next);
      return next;
    });
  }

  if (hh.error) {
    return (
      <main className="message">
        <p>{hh.error}</p>
        <button className="btn btn-quiet" onClick={() => getSupabase().auth.signOut().then(() => (location.href = "/login"))}>Sign out</button>
      </main>
    );
  }
  if (!household || !now) return <main className="message"><p>Loading…</p></main>;

  const current = weather ? describe(weather.code) : null;
  const toBuy = list.items.filter((i) => !i.checked).length;
  const openNew = () => setSheet({ kind: "new", date: weekOffset === 0 ? now : weekStart, hour: Math.min(now.getHours() + 1, 22) });
  const signOut = () => getSupabase().auth.signOut().then(() => (location.href = "/login"));

  const weekNav = (
    <div className="week-nav">
      <button className="icon-btn" onClick={() => setWeekOffset((w) => w - 1)} aria-label="Previous week">‹</button>
      <button className={`week-label${weekOffset === 0 ? " is-now" : ""}`} onClick={() => setWeekOffset(0)} title="Back to this week">
        {weekOffset === 0 ? "This week" : weekLabel(weekStart)}
      </button>
      <button className="icon-btn" onClick={() => setWeekOffset((w) => w + 1)} aria-label="Next week">›</button>
      <label className="jump" title="Go to a date">
        <span aria-hidden="true">📅</span>
        <span className="jump-text">Go to date</span>
        <input
          type="date"
          aria-label="Go to a date"
          onChange={(e) => {
            if (!e.target.value) return;
            const [y, m, d] = e.target.value.split("-").map(Number);
            const target = startOfWeek(new Date(y, m - 1, d));
            setWeekOffset(Math.round((target.getTime() - startOfWeek(today!).getTime()) / (7 * 864e5)));
            e.target.value = "";
          }}
        />
      </label>
    </div>
  );

  const people = (
    <div className="people" role="group" aria-label="Show or hide each person's events">
      {members.map((m) => {
        const on = !hidden.includes(m.id);
        return (
          <button
            key={m.id}
            className={`person${on ? " is-on" : ""}`}
            style={{ ["--c" as string]: m.colour }}
            aria-pressed={on}
            title={on ? `Hide ${m.name}'s events` : `Show ${m.name}'s events`}
            onClick={() => togglePerson(m.id)}
          >
            <Avatar member={m} size={wide ? 58 : 44} photoUrl={photos[m.id]} />
            <span className="person-name">{m.name}</span>
          </button>
        );
      })}
    </div>
  );

  const shared = {
    days: week.days,
    occurrences: week.occurrences,
    dinners: week.dinners,
    members,
    photos,
    weather,
    hidden,
    now,
    onOpen: setSheet,
    onDinner: week.setDinnerNote,
  };

  return (
    <div className={`app${wide ? " is-wide" : ""}`}>
      <header className="top">
        <div className="clock-block">
          <time className="clock" dateTime={now.toISOString()}>{fmt(now, { hour: "2-digit", minute: "2-digit", hour12: false })}</time>
          <span className="today-date">{fmt(now, { weekday: "long", day: "numeric", month: "long" })}</span>
        </div>

        {people}

        <div className="top-right">
          {weather && current && (
            <div className="now-weather" title={`${current.label} in Windlesham`}>
              <span className="now-icon" aria-hidden="true">{current.icon}</span>
              <span className="now-temp">{weather.temp}°</span>
            </div>
          )}
          <button className="icon-btn family-btn" onClick={() => setFamilyOpen(true)} aria-label="Family settings" title="Family">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Zm7.43-2.53a7.8 7.8 0 0 0 0-1.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.4 7.4 0 0 0-1.68-.97l-.36-2.54A.5.5 0 0 0 14.13 3h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.6.24-1.16.57-1.68.97l-2.39-.96a.5.5 0 0 0-.6.22L2.84 9.51a.5.5 0 0 0 .12.64l2.03 1.58a7.8 7.8 0 0 0 0 1.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.13.22.39.3.6.22l2.39-.96c.52.4 1.08.73 1.68.97l.36 2.54c.04.24.25.42.5.42h3.84c.25 0 .46-.18.5-.42l.36-2.54c.6-.24 1.16-.57 1.68-.97l2.39.96c.22.08.47 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58Z"/></svg>
          </button>
          {wide && <button className="btn btn-primary btn-big add-event" onClick={openNew}>+ Event</button>}
        </div>
      </header>

      <main className="body">
        {wide ? (
          <>
            <div className="cal">
              <div className="cal-bar">
                <h2 className="cal-title">{fmt(weekStart, { month: "long", year: "numeric" })}</h2>
                {weekNav}
              </div>
              <WeekGrid {...shared} />
            </div>
            <ShoppingList list={list} members={members} photos={photos} addedBy={addingAs} onPickAdder={(id) => { setAddingAs(id); writeStore(ADDER_KEY, id); }} />
          </>
        ) : tab === "week" ? (
          <>
            <div className="cal-bar">{weekNav}</div>
            <Agenda {...shared} />
          </>
        ) : (
          <ShoppingList list={list} members={members} photos={photos} addedBy={me?.id ?? null} />
        )}
      </main>

      {!wide && (
        <>
          {tab === "week" && <button className="fab" onClick={openNew} aria-label="Add an event">+</button>}
          <nav className="tabs" aria-label="Sections">
            <button className={tab === "week" ? "is-on" : ""} aria-current={tab === "week"} onClick={() => setTab("week")}>Week</button>
            <button className={tab === "list" ? "is-on" : ""} aria-current={tab === "list"} onClick={() => setTab("list")}>Shopping{toBuy ? ` · ${toBuy}` : ""}</button>
          </nav>
        </>
      )}

      <EventSheet
        request={sheet}
        members={members}
        photos={photos}
        onClose={() => setSheet(null)}
        onSave={week.saveEvent}
        onDelete={week.deleteEvent}
        onSkip={(o) => week.skipOccurrence(o.event, o.start)}
      />
      <FamilySheet
        open={familyOpen}
        members={members}
        photos={photos}
        onClose={() => setFamilyOpen(false)}
        onUpdate={hh.updateMember}
        onUpload={hh.uploadPhoto}
        onRemovePhoto={hh.removePhoto}
        onSignOut={signOut}
        extra={<SettingsExtras household={household} members={members} me={me} photos={photos} />}
      />

      {wide && <NightMode now={now} />}
    </div>
  );
}

// Dims the kitchen screen from 22:00 to 06:30. A tap wakes it for two minutes.
function NightMode({ now }: { now: Date }) {
  const [wokenUntil, setWokenUntil] = useState(0);
  const hm = now.getHours() * 60 + now.getMinutes();
  const night = hm >= 22 * 60 || hm < 6 * 60 + 30;
  if (!night || now.getTime() < wokenUntil) return null;
  return (
    <button className="night" onClick={() => setWokenUntil(Date.now() + 2 * 60 * 1000)} aria-label="Wake the screen">
      <span className="night-clock">{fmt(now, { hour: "2-digit", minute: "2-digit", hour12: false })}</span>
    </button>
  );
}
