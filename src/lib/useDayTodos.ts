"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { addDays, fromIsoDay, isoDay } from "@/lib/dates";

// Daily to-dos on the calendar.
// - A to-do belongs to a day. If it isn't ticked, it carries over to today until it is.
// - Ticked to-dos stay on the day they were ticked.
// - Repeating jobs (cleaning rota etc.) make a to-do on each day they fall on. If the last one
//   hasn't been ticked yet, no new copy is made: the old one just keeps carrying over.

export type DayTodo = {
  id: string;
  household_id: string;
  title: string;
  date: string;
  done: boolean;
  done_on: string | null;
  assignee: string | null;
  repeat_id: string | null;
  sort_order: number;
  created_by: string | null;
  created_at: string;
};

export type DayRepeat = {
  id: string;
  household_id: string;
  title: string;
  assignee: string | null;
  freq: "daily" | "weekly" | "monthly";
  interval: number;
  by_day: number[]; // 0 = Monday
  start_date: string;
  created_at: string;
};

// What shows on one day: real to-dos, plus (on future days) the repeating jobs that will appear
export type DayEntry =
  | { kind: "todo"; todo: DayTodo; carried: boolean }
  | { kind: "planned"; repeat: DayRepeat; date: string };

// "Hoover, dust the lounge" is two jobs; "fish and chips" stays one
function splitTodos(text: string) {
  return text
    .split(/,|;|\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1));
}

const weekday = (iso: string) => (fromIsoDay(iso).getDay() + 6) % 7;
const daysBetween = (a: string, b: string) => Math.round((fromIsoDay(b).getTime() - fromIsoDay(a).getTime()) / 864e5);

export function repeatFallsOn(r: DayRepeat, iso: string) {
  if (iso < r.start_date) return false;
  const gap = daysBetween(r.start_date, iso);
  if (r.freq === "daily") return gap % r.interval === 0;
  if (r.freq === "weekly") {
    const days = r.by_day.length ? r.by_day : [weekday(r.start_date)];
    if (!days.includes(weekday(iso))) return false;
    const weeks = Math.floor((gap + weekday(r.start_date)) / 7);
    return weeks % r.interval === 0;
  }
  // Monthly on the same date; the 31st falls on the last day of shorter months
  const s = fromIsoDay(r.start_date);
  const d = fromIsoDay(iso);
  const months = (d.getFullYear() - s.getFullYear()) * 12 + d.getMonth() - s.getMonth();
  if (months % r.interval !== 0) return false;
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return d.getDate() === Math.min(s.getDate(), last);
}

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export function describeRepeat(r: Pick<DayRepeat, "freq" | "interval" | "by_day" | "start_date">) {
  if (r.freq === "daily") return r.interval === 1 ? "Every day" : `Every ${r.interval} days`;
  if (r.freq === "weekly") {
    const days = (r.by_day.length ? r.by_day : [weekday(r.start_date)]).slice().sort();
    const names = days.length === 7 ? "every day" : days.length === 5 && !days.includes(5) && !days.includes(6) ? "weekdays" : days.map((d) => DOW[d]).join(", ");
    return `${r.interval === 2 ? "Every 2 weeks" : "Every week"}: ${names}`;
  }
  const n = fromIsoDay(r.start_date).getDate();
  const th = n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th";
  return `${r.interval === 1 ? "Every month" : `Every ${r.interval} months`} on the ${n}${th}`;
}

export function useDayTodos(householdId: string | null, fromIso: string, toIso: string, todayIso: string) {
  const [todos, setTodos] = useState<DayTodo[]>([]);
  const [repeats, setRepeats] = useState<DayRepeat[]>([]);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const madeFor = useRef<string>("");

  const load = useCallback(async () => {
    if (!householdId) return;
    const sb = getSupabase();
    const lookBack = isoDay(addDays(fromIsoDay(todayIso), -70));
    const [{ data: t }, { data: r }] = await Promise.all([
      sb
        .from("day_todos")
        .select("*")
        .eq("household_id", householdId)
        .or(`done.eq.false,and(date.gte.${fromIso < lookBack ? fromIso : lookBack},date.lte.${toIso}),and(done_on.gte.${fromIso},done_on.lte.${toIso})`)
        .order("sort_order")
        .order("created_at"),
      sb.from("day_todo_repeats").select("*").eq("household_id", householdId).order("created_at"),
    ]);
    const rows = (t ?? []) as DayTodo[];
    const reps = (r ?? []) as DayRepeat[];
    setTodos(rows);
    setRepeats(reps);

    // Make today's copies of repeating jobs (once per device per day; the database ignores duplicates)
    if (madeFor.current === todayIso) return;
    madeFor.current = todayIso;
    const make: Partial<DayTodo>[] = [];
    for (const rep of reps) {
      const mine = rows.filter((x) => x.repeat_id === rep.id);
      if (mine.some((x) => !x.done)) continue; // still carrying an unticked one
      const last = mine.map((x) => x.date).filter((d) => d <= todayIso).sort().pop() ?? "";
      // The most recent day it fell on since the last copy (at most 70 days back)
      for (let i = 0; i <= 70; i++) {
        const d = isoDay(addDays(fromIsoDay(todayIso), -i));
        if (d <= last || d < rep.start_date) break;
        if (repeatFallsOn(rep, d)) {
          make.push({ household_id: householdId, title: rep.title, date: d, assignee: rep.assignee, repeat_id: rep.id, sort_order: -1 });
          break;
        }
      }
    }
    if (make.length) {
      await sb.from("day_todos").upsert(make, { onConflict: "repeat_id,date", ignoreDuplicates: true });
      const { data: again } = await sb
        .from("day_todos")
        .select("*")
        .eq("household_id", householdId)
        .or(`done.eq.false,and(date.gte.${fromIso < lookBack ? fromIso : lookBack},date.lte.${toIso}),and(done_on.gte.${fromIso},done_on.lte.${toIso})`)
        .order("sort_order")
        .order("created_at");
      if (again) setTodos(again as DayTodo[]);
    }
  }, [householdId, fromIso, toIso, todayIso]);

  useEffect(() => {
    if (!householdId) return;
    void load();
    const sb = getSupabase();
    const soon = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void load(), 250);
    };
    const channel = sb
      .channel(`day-todos-${householdId}-${fromIso}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "day_todos", filter: `household_id=eq.${householdId}` }, soon)
      .on("postgres_changes", { event: "*", schema: "public", table: "day_todo_repeats", filter: `household_id=eq.${householdId}` }, soon)
      .subscribe();
    const onVisible = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      sb.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [householdId, fromIso, load]);

  const save = useCallback(
    async (run: () => PromiseLike<{ error: unknown }>) => {
      const { error } = await run();
      if (error) {
        setError("That didn't save. Check the connection and try again.");
        void load();
      } else setError(null);
    },
    [load],
  );

  // Entries for each day in the range
  const byDay = useMemo(() => {
    const map = new Map<string, DayEntry[]>();
    const push = (iso: string, e: DayEntry) => {
      if (iso < fromIso || iso > toIso) return;
      if (!map.has(iso)) map.set(iso, []);
      map.get(iso)!.push(e);
    };
    for (const t of todos) {
      if (t.done) push(t.done_on ?? t.date, { kind: "todo", todo: t, carried: false });
      else if (t.date < todayIso) push(todayIso, { kind: "todo", todo: t, carried: true });
      else push(t.date, { kind: "todo", todo: t, carried: false });
    }
    // Future days: show the repeating jobs that will turn up
    for (let d = fromIsoDay(fromIso > todayIso ? fromIso : isoDay(addDays(fromIsoDay(todayIso), 1))); isoDay(d) <= toIso; d = addDays(d, 1)) {
      const iso = isoDay(d);
      for (const rep of repeats) {
        if (repeatFallsOn(rep, iso) && !todos.some((t) => t.repeat_id === rep.id && t.date === iso)) push(iso, { kind: "planned", repeat: rep, date: iso });
      }
    }
    for (const list of map.values()) {
      const rank = (e: DayEntry) => (e.kind === "todo" ? (e.todo.done ? 3 : e.carried ? 0 : 1) : 2);
      list.sort((a, b) => rank(a) - rank(b) || (a.kind === "todo" && b.kind === "todo" ? a.todo.date.localeCompare(b.todo.date) || a.todo.sort_order - b.todo.sort_order : 0));
    }
    return map;
  }, [todos, repeats, fromIso, toIso, todayIso]);

  const add = useCallback(
    (date: string, text: string, createdBy: string | null, assignee: string | null = null) => {
      if (!householdId) return 0;
      const rows: DayTodo[] = splitTodos(text).map((title, i) => ({
        id: crypto.randomUUID(),
        household_id: householdId,
        title: title.slice(0, 200),
        date,
        done: false,
        done_on: null,
        assignee,
        repeat_id: null,
        sort_order: Date.now() % 1e6 + i,
        created_by: createdBy,
        created_at: new Date().toISOString(),
      }));
      if (!rows.length) return 0;
      setTodos((p) => [...p, ...rows]);
      void save(() => getSupabase().from("day_todos").insert(rows));
      return rows.length;
    },
    [householdId, save],
  );

  const update = useCallback(
    (id: string, patch: Partial<Pick<DayTodo, "title" | "date" | "assignee" | "done" | "done_on">>) => {
      setTodos((p) => p.map((t) => (t.id === id ? { ...t, ...patch } : t)));
      void save(() => getSupabase().from("day_todos").update(patch).eq("id", id));
    },
    [save],
  );

  const toggle = useCallback(
    (t: DayTodo) => update(t.id, t.done ? { done: false, done_on: null } : { done: true, done_on: todayIso }),
    [update, todayIso],
  );

  // Tick a repeating job ahead of its day
  const tickPlanned = useCallback(
    (rep: DayRepeat, date: string) => {
      if (!householdId) return;
      const row: DayTodo = {
        id: crypto.randomUUID(),
        household_id: householdId,
        title: rep.title,
        date,
        done: true,
        done_on: todayIso,
        assignee: rep.assignee,
        repeat_id: rep.id,
        sort_order: -1,
        created_by: null,
        created_at: new Date().toISOString(),
      };
      setTodos((p) => [...p, row]);
      void save(() => getSupabase().from("day_todos").upsert(row, { onConflict: "repeat_id,date" }));
    },
    [householdId, save, todayIso],
  );

  const remove = useCallback(
    (id: string) => {
      setTodos((p) => p.filter((t) => t.id !== id));
      void save(() => getSupabase().from("day_todos").delete().eq("id", id));
    },
    [save],
  );

  const saveRepeat = useCallback(
    async (r: Omit<DayRepeat, "id" | "household_id" | "created_at"> & { id?: string }) => {
      if (!householdId) return;
      const row = { ...r, id: r.id ?? crypto.randomUUID(), household_id: householdId, title: r.title.trim().slice(0, 200) };
      setRepeats((p) => [...p.filter((x) => x.id !== row.id), { ...row, created_at: new Date().toISOString() }]);
      const sb = getSupabase();
      const { error } = await sb.from("day_todo_repeats").upsert(row);
      if (error) {
        setError("That didn't save. Check the connection and try again.");
        return;
      }
      // Keep unticked copies in step with a changed name or person
      if (r.id) await sb.from("day_todos").update({ title: row.title, assignee: row.assignee }).eq("repeat_id", row.id).eq("done", false);
      madeFor.current = "";
      await load();
    },
    [householdId, load],
  );

  // Stop a repeating job. Its unticked copy goes too; ticked ones stay as a record.
  const deleteRepeat = useCallback(
    async (id: string) => {
      setRepeats((p) => p.filter((x) => x.id !== id));
      setTodos((p) => p.filter((t) => !(t.repeat_id === id && !t.done)));
      const sb = getSupabase();
      await sb.from("day_todos").delete().eq("repeat_id", id).eq("done", false);
      await save(() => sb.from("day_todo_repeats").delete().eq("id", id));
    },
    [save],
  );

  return { todos, repeats, byDay, error, add, update, toggle, tickPlanned, remove, saveRepeat, deleteRepeat };
}

export type DayTodos = ReturnType<typeof useDayTodos>;
