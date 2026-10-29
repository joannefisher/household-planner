"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { nextSevenDays } from "@/lib/dates";
import type { Dinner, Household, Member, PlannerEvent } from "@/lib/types";

export function useHousehold() {
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [me, setMe] = useState<Member | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sb = getSupabase();
    (async () => {
      const { data: auth } = await sb.auth.getUser();
      const { data: mine } = await sb.from("members").select("*").eq("user_id", auth.user?.id ?? "").maybeSingle();
      if (!mine) {
        setError("This login isn't linked to a household member.");
        return;
      }
      const [{ data: hh }, { data: all }] = await Promise.all([
        sb.from("households").select("*").eq("id", mine.household_id).single(),
        sb.from("members").select("*").eq("household_id", mine.household_id).order("sort_order"),
      ]);
      setMe(mine as Member);
      setHousehold(hh as Household);
      setMembers((all ?? []) as Member[]);
    })();
  }, []);

  return { household, members, me, error };
}

export function useWeek(householdId: string | null) {
  const [events, setEvents] = useState<PlannerEvent[]>([]);
  const [dinners, setDinners] = useState<Dinner[]>([]);

  const load = useCallback(async () => {
    if (!householdId) return;
    const sb = getSupabase();
    const days = nextSevenDays();
    const start = new Date(`${days[0].iso}T00:00:00`);
    const end = new Date(start.getTime() + 8 * 864e5);
    const [{ data: ev }, { data: dn }] = await Promise.all([
      sb
        .from("events")
        .select("id,title,starts_at,ends_at,all_day,location,event_members(member_id)")
        .eq("household_id", householdId)
        .lt("starts_at", end.toISOString())
        .or(`starts_at.gte.${start.toISOString()},ends_at.gte.${start.toISOString()}`)
        .order("starts_at"),
      sb
        .from("meal_plan")
        .select("id,date,note,recipe_id,recipes(title)")
        .eq("household_id", householdId)
        .gte("date", days[0].iso)
        .lte("date", days[6].iso),
    ]);
    setEvents((ev ?? []) as unknown as PlannerEvent[]);
    setDinners((dn ?? []) as unknown as Dinner[]);
  }, [householdId]);

  useEffect(() => {
    if (!householdId) return;
    void load();
    const sb = getSupabase();
    const channel = sb
      .channel(`week-${householdId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "events", filter: `household_id=eq.${householdId}` }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "event_members" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "meal_plan", filter: `household_id=eq.${householdId}` }, () => void load())
      .subscribe();
    // Roll the week forward after midnight, and catch up after the screen wakes
    const timer = setInterval(() => void load(), 10 * 60 * 1000);
    const onVisible = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      sb.removeChannel(channel);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [householdId, load]);

  const setDinnerNote = useCallback(
    async (date: string, note: string) => {
      if (!householdId) return;
      const sb = getSupabase();
      const text = note.trim();
      if (!text) await sb.from("meal_plan").delete().eq("household_id", householdId).eq("date", date);
      else await sb.from("meal_plan").upsert({ household_id: householdId, date, note: text, recipe_id: null }, { onConflict: "household_id,date" });
      void load();
    },
    [householdId, load],
  );

  return { events, dinners, setDinnerNote };
}
