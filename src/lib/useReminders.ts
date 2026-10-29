"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { addDays, fromIsoDay, isoDay } from "@/lib/dates";
import { occurrencesBetween } from "@/lib/recurrence";
import type { Occurrence, PlannerEvent } from "@/lib/types";

// Reminders show on screen from 7am on the day they're due until the event starts.
// "Done" clears one for good; "Snooze" hides it until 7am tomorrow.

export type Timing = "1d" | "1w" | "1m";
export const TIMING_LABEL: Record<Timing, string> = { "1d": "tomorrow", "1w": "in a week", "1m": "in a month" };
const ORDER: Timing[] = ["1d", "1w", "1m"]; // nearest first

type State = { event_id: string; occurrence_date: string; timing: Timing; dismissed_at: string | null; snoozed_until: string | null };
export type DueReminder = { key: string; occurrence: Occurrence; timing: Timing; date: string };

function fireTime(occStart: Date, timing: Timing) {
  const day = new Date(occStart.getFullYear(), occStart.getMonth(), occStart.getDate(), 7, 0);
  if (timing === "1d") return addDays(day, -1);
  if (timing === "1w") return addDays(day, -7);
  const m = new Date(day);
  m.setMonth(m.getMonth() - 1);
  return m;
}

export function useReminders(householdId: string | null, now: Date | null) {
  const [events, setEvents] = useState<PlannerEvent[]>([]);
  const [states, setStates] = useState<State[]>([]);

  const load = useCallback(async () => {
    if (!householdId) return;
    const sb = getSupabase();
    const today = isoDay(new Date());
    const until = addDays(new Date(), 33).toISOString();
    const [{ data: ev }, { data: st }] = await Promise.all([
      sb
        .from("events")
        .select("id,title,starts_at,ends_at,all_day,rrule,location,notes,reminders,event_members(member_id)")
        .eq("household_id", householdId)
        .neq("reminders", "{}")
        .lt("starts_at", until),
      sb.from("reminder_states").select("event_id,occurrence_date,timing,dismissed_at,snoozed_until").eq("household_id", householdId).gte("occurrence_date", today),
    ]);
    setEvents((ev ?? []) as unknown as PlannerEvent[]);
    setStates((st ?? []) as State[]);
  }, [householdId]);

  useEffect(() => {
    if (!householdId) return;
    void load();
    const sb = getSupabase();
    const channel = sb
      .channel(`reminders-${householdId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "reminder_states", filter: `household_id=eq.${householdId}` }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "events", filter: `household_id=eq.${householdId}` }, () => void load())
      .subscribe();
    const timer = setInterval(() => void load(), 30 * 60 * 1000);
    return () => {
      sb.removeChannel(channel);
      clearInterval(timer);
    };
  }, [householdId, load]);

  const minute = now ? Math.floor(now.getTime() / 60000) : 0;
  const due = useMemo<DueReminder[]>(() => {
    if (!now) return [];
    const from = isoDay(now);
    const to = isoDay(addDays(now, 32));
    const out: DueReminder[] = [];
    for (const occ of occurrencesBetween(events, from, to)) {
      if (occ.start <= now) continue;
      const wanted = (occ.event.reminders ?? []) as Timing[];
      const date = isoDay(occ.start);
      // Of the reminders that have come round, show only the nearest one
      const fired = ORDER.filter((t) => wanted.includes(t) && fireTime(occ.start, t) <= now);
      const timing = fired[0];
      if (!timing) continue;
      const st = states.find((s) => s.event_id === occ.event.id && s.occurrence_date === date && s.timing === timing);
      if (st?.dismissed_at) continue;
      if (st?.snoozed_until && new Date(st.snoozed_until) > now) continue;
      out.push({ key: `${occ.key}:${timing}`, occurrence: occ, timing, date });
    }
    return out.sort((a, b) => a.occurrence.start.getTime() - b.occurrence.start.getTime());
  }, [events, states, minute]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = useCallback(
    async (r: DueReminder, kind: "done" | "snooze") => {
      if (!householdId) return;
      const tomorrow7 = fromIsoDay(isoDay(addDays(new Date(), 1)), 7, 0).toISOString();
      const row = {
        household_id: householdId,
        event_id: r.occurrence.event.id,
        occurrence_date: r.date,
        timing: r.timing,
        dismissed_at: kind === "done" ? new Date().toISOString() : null,
        snoozed_until: kind === "snooze" ? tomorrow7 : null,
        updated_at: new Date().toISOString(),
      };
      setStates((prev) => [...prev.filter((s) => !(s.event_id === row.event_id && s.occurrence_date === row.occurrence_date && s.timing === row.timing)), row]);
      await getSupabase().from("reminder_states").upsert(row, { onConflict: "event_id,occurrence_date,timing" });
    },
    [householdId],
  );

  return { due, done: (r: DueReminder) => act(r, "done"), snooze: (r: DueReminder) => act(r, "snooze") };
}
