"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { addDays, fmt, isoDay, startOfWeek, weekLabel } from "@/lib/dates";
import { describe, fetchWeather, type Weather } from "@/lib/weather";
import { useHousehold, useWeek } from "@/lib/useHousehold";
import { useShoppingList } from "@/lib/useShoppingList";
import { Avatar } from "./Avatar";
import { DinnersSheet, type DinnerRequest } from "./DinnersSheet";
import { shopForDinner } from "@/lib/shopDinner";
import { useReminders } from "@/lib/useReminders";
import { Reminders } from "./Reminders";
import { EventSheet, type SheetRequest } from "./EventSheet";
import { FamilySheet } from "./FamilySheet";
import { ListsTab } from "./ListsTab";
import { SettingsExtras } from "./SettingsExtras";
import { ShoppingList } from "./ShoppingList";
import { TodoPanel } from "./TodoPanel";
import { Agenda, MonthGrid, WeekGrid } from "./Week";
import { DayTodoList, DayTodoSheets } from "./DayTodos";
import { useDayTodos, type DayTodo } from "@/lib/useDayTodos";

const ADDER_KEY = "planner.addingAs";
const HIDDEN_KEY = "planner.hiddenPeople";
const TAB_KEY = "planner.tab";
const VIEW_KEY = "planner.calView";

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

// The big clock ticks on its own, so the rest of the screen isn't redrawn every second
function Clock() {
  const now = useNow(1000);
  if (!now) return null;
  return <time className="clock" dateTime={now.toISOString()}>{fmt(now, { hour: "2-digit", minute: "2-digit", hour12: false })}</time>;
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
  const now = useNow(20 * 1000);
  const wide = useWide();
  const [weekOffset, setWeekOffset] = useState(0);
  const [view, setView] = useState<"week" | "month">("week");
  const [monthOffset, setMonthOffset] = useState(0);
  const [focusDay, setFocusDay] = useState<string | null>(null);
  const today = now ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) : null;
  const weekStart = useMemo(() => addDays(startOfWeek(today ?? new Date()), weekOffset * 7), [today?.getTime(), weekOffset]); // eslint-disable-line react-hooks/exhaustive-deps
  const week = useWeek(household?.id ?? null, weekStart);
  // Month view: whole weeks from the Monday on or before the 1st to the Sunday on or after the last day
  const monthFirst = useMemo(() => {
    const t = today ?? new Date();
    return new Date(t.getFullYear(), t.getMonth() + monthOffset, 1);
  }, [today?.getTime(), monthOffset]); // eslint-disable-line react-hooks/exhaustive-deps
  const monthStart = useMemo(() => startOfWeek(monthFirst), [monthFirst]);
  const monthLength = useMemo(() => {
    const last = new Date(monthFirst.getFullYear(), monthFirst.getMonth() + 1, 0);
    return Math.round((startOfWeek(last).getTime() - monthStart.getTime()) / 864e5) + 7;
  }, [monthFirst, monthStart]);
  const month = useWeek(view === "month" ? household?.id ?? null : null, monthStart, monthLength);
  const todayIso = isoDay(today ?? new Date());
  const range = view === "month" ? month.days : week.days;
  const dayTodos = useDayTodos(household?.id ?? null, range[0].iso, range[range.length - 1].iso, todayIso);
  const [todoEditing, setTodoEditing] = useState<DayTodo | null>(null);
  const [repeatsOpen, setRepeatsOpen] = useState(false);
  const list = useShoppingList(household?.id ?? null);
  const weather = useWeather(household?.latitude, household?.longitude);
  const reminders = useReminders(household?.id ?? null, now);

  const [tab, setTab] = useState<"week" | "list" | "lists">("week");
  const chooseTab = (t: "week" | "list" | "lists") => {
    setTab(t);
    writeStore(TAB_KEY, t);
  };
  useEffect(() => {
    const saved = readStore<string>(TAB_KEY, "week");
    if (saved === "list" || saved === "lists") setTab(saved);
    if (readStore<string>(VIEW_KEY, "week") === "month") setView("month");
  }, []);
  const chooseView = (v: "week" | "month") => {
    setView(v);
    writeStore(VIEW_KEY, v);
  };

  // After tapping a day in the month, scroll the phone's week to that day
  useEffect(() => {
    if (!focusDay || view !== "week") return;
    const t = setTimeout(() => {
      document.getElementById(`day-${focusDay}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      setFocusDay(null);
    }, 80);
    return () => clearTimeout(t);
  }, [focusDay, view, week.days]);
  const [sheet, setSheet] = useState<SheetRequest | null>(null);
  const [familyOpen, setFamilyOpen] = useState(false);
  const [familyMember, setFamilyMember] = useState<string | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);

  function editPerson(id: string | null) {
    setFamilyMember(id);
    setFamilyOpen(true);
  }
  // Press and hold a face to edit that person; a normal tap still shows or hides their events
  const holdHandlers = (id: string) => ({
    onPointerDown: () => {
      held.current = false;
      holdTimer.current = setTimeout(() => {
        held.current = true;
        editPerson(id);
      }, 550);
    },
    onPointerUp: () => holdTimer.current && clearTimeout(holdTimer.current),
    onPointerLeave: () => holdTimer.current && clearTimeout(holdTimer.current),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });
  const [dinnerReq, setDinnerReq] = useState<DinnerRequest | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);
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

  const goToDate = (y: number, m: number, d: number) => {
    const target = startOfWeek(new Date(y, m, d));
    setWeekOffset(Math.round((target.getTime() - startOfWeek(today!).getTime()) / (7 * 864e5)));
    setMonthOffset((y - today!.getFullYear()) * 12 + m - today!.getMonth());
  };
  const isMonth = view === "month";
  const viewSwitch = (
    <div className="seg view-seg" role="tablist" aria-label="Calendar view">
      <button role="tab" aria-selected={!isMonth} className={!isMonth ? "is-on" : ""} onClick={() => chooseView("week")}>Week</button>
      <button role="tab" aria-selected={isMonth} className={isMonth ? "is-on" : ""} onClick={() => chooseView("month")}>Month</button>
    </div>
  );
  const weekNav = (
    <div className="week-nav">
      {isMonth ? (
        <>
          <button className="icon-btn" onClick={() => setMonthOffset((w) => w - 1)} aria-label="Previous month">‹</button>
          <button className={`week-label${monthOffset === 0 ? " is-now" : ""}`} onClick={() => setMonthOffset(0)} title="Back to this month">
            {monthOffset === 0 ? "This month" : fmt(monthFirst, { month: wide ? "long" : "short", year: monthFirst.getFullYear() === now.getFullYear() ? undefined : "numeric" })}
          </button>
          <button className="icon-btn" onClick={() => setMonthOffset((w) => w + 1)} aria-label="Next month">›</button>
        </>
      ) : (
        <>
          <button className="icon-btn" onClick={() => setWeekOffset((w) => w - 1)} aria-label="Previous week">‹</button>
          <button className={`week-label${weekOffset === 0 ? " is-now" : ""}`} onClick={() => setWeekOffset(0)} title="Back to this week">
            {weekOffset === 0 ? "This week" : weekLabel(weekStart)}
          </button>
          <button className="icon-btn" onClick={() => setWeekOffset((w) => w + 1)} aria-label="Next week">›</button>
        </>
      )}
      <label className="jump" title="Go to a date">
        <span aria-hidden="true">📅</span>
        <span className="jump-text">Go to date</span>
        <input
          type="date"
          aria-label="Go to a date"
          onChange={(e) => {
            if (!e.target.value) return;
            const [y, m, d] = e.target.value.split("-").map(Number);
            goToDate(y, m - 1, d);
            setFocusDay(e.target.value);
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
            onClick={() => (held.current ? (held.current = false) : togglePerson(m.id))}
            {...holdHandlers(m.id)}
          >
            <Avatar member={m} size={wide ? 58 : 44} photoUrl={photos[m.id]} />
            <span className="person-name">{m.name}</span>
          </button>
        );
      })}
    </div>
  );

  const todoSlot = (iso: string, compact: boolean) => (
    <DayTodoList
      iso={iso}
      todayIso={todayIso}
      entries={dayTodos.byDay.get(iso) ?? []}
      dt={dayTodos}
      members={members}
      photos={photos}
      me={wide ? members.find((m) => m.id === addingAs) ?? me : me}
      compact={compact}
      onEdit={setTodoEditing}
      onRepeats={() => setRepeatsOpen(true)}
    />
  );
  const pickDay = (date: Date) => {
    goToDate(date.getFullYear(), date.getMonth(), date.getDate());
    setFocusDay(isoDay(date));
    chooseView("week");
  };
  const monthGrid = (
    <MonthGrid
      days={month.days}
      month={monthFirst.getMonth()}
      occurrences={month.occurrences}
      dinners={month.dinners}
      members={members}
      hidden={hidden}
      now={now}
      wide={wide}
      todoCount={(iso) => (iso < todayIso ? 0 : (dayTodos.byDay.get(iso) ?? []).filter((e) => e.kind === "planned" || !e.todo.done).length)}
      onPickDay={pickDay}
    />
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
    onDinnerOpen: (date: string) => setDinnerReq({ k: "day", date }),
    onDinnerShop: async (date: string) => {
      setToast("Adding ingredients…");
      setToast(await shopForDinner(household.id, date, wide ? addingAs : me?.id ?? null));
    },
    todoSlot,
  };

  return (
    <div className={`app${wide ? " is-wide" : ""}`}>
      <header className="top">
        <div className="clock-block">
          {wide && <Clock />}
          <span className="today-date">{fmt(now, { weekday: "long", day: "numeric", month: "long" })}</span>
        </div>

        {tab === "week" && people}

        <div className="top-right">
          {weather && current && (
            <div className="now-weather" title={`${current.label} in Windlesham`}>
              <span className="now-icon" aria-hidden="true">{current.icon}</span>
              <span className="now-temp">{weather.temp}°</span>
            </div>
          )}
          <button className="icon-btn family-btn" onClick={() => editPerson(null)} aria-label="Family settings" title="Family">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Zm7.43-2.53a7.8 7.8 0 0 0 0-1.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.4 7.4 0 0 0-1.68-.97l-.36-2.54A.5.5 0 0 0 14.13 3h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.6.24-1.16.57-1.68.97l-2.39-.96a.5.5 0 0 0-.6.22L2.84 9.51a.5.5 0 0 0 .12.64l2.03 1.58a7.8 7.8 0 0 0 0 1.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.13.22.39.3.6.22l2.39-.96c.52.4 1.08.73 1.68.97l.36 2.54c.04.24.25.42.5.42h3.84c.25 0 .46-.18.5-.42l.36-2.54c.6-.24 1.16-.57 1.68-.97l2.39.96c.22.08.47 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58Z"/></svg>
          </button>
          {wide && tab === "week" && <button className="btn btn-primary btn-big add-event" onClick={openNew}>+ Event</button>}
        </div>
      </header>

      <Reminders due={reminders.due} members={members} photos={photos} onDone={reminders.done} onSnooze={reminders.snooze} />

      <main className="body">
        {tab === "week" ? (
          wide ? (
            <div className="cal">
              <div className="cal-bar">
                <h2 className="cal-title">{fmt(isMonth ? monthFirst : weekStart, { month: "long", year: "numeric" })}</h2>
                {viewSwitch}
                {weekNav}
              </div>
              {isMonth ? monthGrid : <WeekGrid {...shared} />}
            </div>
          ) : (
            <>
              <div className="cal-bar is-phone">
                {viewSwitch}
                {weekNav}
              </div>
              {isMonth ? (
                <>
                  <h2 className="cal-title mg-title">{fmt(monthFirst, { month: "long", year: "numeric" })}</h2>
                  {monthGrid}
                  <p className="mg-hint">Tap a day to see it in full.</p>
                </>
              ) : (
                <Agenda {...shared} />
              )}
            </>
          )
        ) : tab === "lists" ? (
          // The kitchen screen never shows gift ideas, so surprises stay secret
          wide ? <div className="full-panel"><TodoPanel householdId={household.id} members={members} photos={photos} me={me} /></div> : <ListsTab householdId={household.id} members={members} photos={photos} me={me} />
        ) : (
          <ShoppingList
            list={list}
            members={members}
            photos={photos}
            addedBy={wide ? addingAs : me?.id ?? null}
            onPickAdder={wide ? (id) => { setAddingAs(id); writeStore(ADDER_KEY, id); } : undefined}
            full={wide}
          />
        )}
      </main>

      {tab === "week" && !wide && <button className="fab" onClick={openNew} aria-label="Add an event">+</button>}
      <nav className="tabs" aria-label="Sections">
        <button className={tab === "week" ? "is-on" : ""} aria-current={tab === "week"} onClick={() => chooseTab("week")}>
          <span className="tab-icon" aria-hidden="true">📅</span>
          <span className="tab-label">{wide ? "Calendar" : "Week"}</span>
        </button>
        <button className={tab === "list" ? "is-on" : ""} aria-current={tab === "list"} onClick={() => chooseTab("list")}>
          <span className="tab-icon" aria-hidden="true">🛒</span>
          <span className="tab-label">Shopping</span>
          {toBuy > 0 && <span className="tab-count">{toBuy}</span>}
        </button>
        <button className={tab === "lists" ? "is-on" : ""} aria-current={tab === "lists"} onClick={() => chooseTab("lists")}>
          <span className="tab-icon" aria-hidden="true">✅</span>
          <span className="tab-label">Lists</span>
        </button>
      </nav>

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
        initialMember={familyMember}
        onUpdate={hh.updateMember}
        onUpload={hh.uploadPhoto}
        onRemovePhoto={hh.removePhoto}
        onSignOut={signOut}
        extra={<SettingsExtras household={household} members={members} me={me} photos={photos} onOpenDinners={() => { setFamilyOpen(false); setDinnerReq({ k: "week" }); }} />}
      />

      <DayTodoSheets
        dt={dayTodos}
        members={members}
        photos={photos}
        editing={todoEditing}
        repeatsOpen={repeatsOpen}
        onCloseEdit={() => setTodoEditing(null)}
        onCloseRepeats={() => setRepeatsOpen(false)}
        onOpenRepeats={() => setRepeatsOpen(true)}
      />
      {dayTodos.error && <p className="planner-toast" role="alert">{dayTodos.error}</p>}
      {toast && <p className="planner-toast" role="status">{toast}</p>}
      <DinnersSheet request={dinnerReq} onClose={() => setDinnerReq(null)} householdId={household.id} days={week.days} meId={wide ? addingAs : me?.id ?? null} />

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
