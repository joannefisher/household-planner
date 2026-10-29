"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { fmt } from "@/lib/dates";
import { describe, fetchWeather, type Weather } from "@/lib/weather";
import { useHousehold, useWeek } from "@/lib/useHousehold";
import { useShoppingList } from "@/lib/useShoppingList";
import { ShoppingList } from "./ShoppingList";
import { Week } from "./Week";

const ADDER_KEY = "planner.addingAs";

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
  const { household, members, me, error } = useHousehold();
  const list = useShoppingList(household?.id ?? null);
  const week = useWeek(household?.id ?? null);
  const weather = useWeather(household?.latitude, household?.longitude);
  const now = useNow(1000);
  const wide = useWide();
  const [tab, setTab] = useState<"week" | "list">("week");
  const [addingAs, setAddingAs] = useState<string | null>(null);

  useEffect(() => {
    if (!me) return;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(ADDER_KEY);
    } catch {}
    setAddingAs(saved && members.some((m) => m.id === saved) ? saved : me.id);
  }, [me, members]);

  function chooseAdder(id: string) {
    setAddingAs(id);
    try {
      localStorage.setItem(ADDER_KEY, id);
    } catch {}
  }

  if (error) {
    return (
      <main className="message">
        <p>{error}</p>
        <button className="btn btn-quiet" onClick={() => getSupabase().auth.signOut().then(() => (location.href = "/login"))}>
          Sign out
        </button>
      </main>
    );
  }
  if (!household || !now) return <main className="message"><p>Loading…</p></main>;

  const current = weather ? describe(weather.code) : null;
  const adder = wide ? addingAs : me?.id ?? null;

  return (
    <div className={`app${wide ? " is-wide" : ""}`}>
      <header className="top">
        <div className="clock-block">
          <time className="clock" dateTime={now.toISOString()}>
            {fmt(now, { hour: "2-digit", minute: "2-digit", hour12: false })}
          </time>
          <span className="today-date">{fmt(now, { weekday: "long", day: "numeric", month: "long" })}</span>
        </div>

        {weather && current && (
          <div className="now-weather">
            <span className="now-icon" aria-hidden="true">{current.icon}</span>
            <span className="now-temp">{weather.temp}°</span>
            <span className="now-label">
              {current.label}
              <br />
              <span className="muted">Windlesham</span>
            </span>
          </div>
        )}

        {wide ? (
          // On the kitchen screen the colour chips double as "who's adding?"
          <div className="family" role="group" aria-label="Who's adding to the list">
            <span className="family-label">Adding as</span>
            {members.map((m) => (
              <button
                key={m.id}
                className={`who${addingAs === m.id ? " is-on" : ""}`}
                style={{ ["--c" as string]: m.colour }}
                aria-pressed={addingAs === m.id}
                onClick={() => chooseAdder(m.id)}
              >
                <span className="dot" />
                {m.name}
              </button>
            ))}
          </div>
        ) : (
          <div className="family" aria-label="Family colours">
            {members.map((m) => (
              <span key={m.id} className="who is-static" style={{ ["--c" as string]: m.colour }}>
                <span className="dot" />
                {m.name}
              </span>
            ))}
          </div>
        )}
      </header>

      <main className="body">
        {(wide || tab === "week") && (
          <Week events={week.events} dinners={week.dinners} members={members} weather={weather} onDinner={week.setDinnerNote} />
        )}
        {(wide || tab === "list") && <ShoppingList list={list} members={members} addedBy={adder} />}
      </main>

      {!wide && (
        <nav className="tabs" aria-label="Sections">
          <button className={tab === "week" ? "is-on" : ""} aria-current={tab === "week"} onClick={() => setTab("week")}>
            Week
          </button>
          <button className={tab === "list" ? "is-on" : ""} aria-current={tab === "list"} onClick={() => setTab("list")}>
            Shopping{list.items.filter((i) => !i.checked).length ? ` (${list.items.filter((i) => !i.checked).length})` : ""}
          </button>
        </nav>
      )}

      {wide && <NightMode now={now} />}
    </div>
  );
}

// Dims the kitchen screen from 22:00 to 06:30. A tap wakes it for two minutes.
function NightMode({ now }: { now: Date }) {
  const [wokenUntil, setWokenUntil] = useState(0);
  const hm = Number(fmt(now, { hour: "2-digit", hour12: false })) * 60 + Number(fmt(now, { minute: "2-digit" }));
  const night = hm >= 22 * 60 || hm < 6 * 60 + 30;
  if (!night || now.getTime() < wokenUntil) return null;
  return (
    <button className="night" onClick={() => setWokenUntil(Date.now() + 2 * 60 * 1000)} aria-label="Wake the screen">
      <span className="night-clock">{fmt(now, { hour: "2-digit", minute: "2-digit", hour12: false })}</span>
    </button>
  );
}
