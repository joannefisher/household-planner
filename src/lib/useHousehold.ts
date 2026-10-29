"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { addDays, isoDay, weekDays } from "@/lib/dates";
import { formatRule, occurrencesBetween, parseRule } from "@/lib/recurrence";
import type { Dinner, Household, Member, PlannerEvent } from "@/lib/types";

export function useHousehold() {
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const loadMembers = useCallback(async (householdId: string) => {
    const sb = getSupabase();
    const { data } = await sb.from("members").select("*").eq("household_id", householdId).order("sort_order");
    const list = (data ?? []) as Member[];
    setMembers(list);
    const paths = list.map((m) => m.photo_path).filter(Boolean) as string[];
    if (paths.length) {
      const { data: signed } = await sb.storage.from("avatars").createSignedUrls(paths, 60 * 60 * 24);
      const byPath = Object.fromEntries((signed ?? []).map((s) => [s.path, s.signedUrl]));
      setPhotos(Object.fromEntries(list.filter((m) => m.photo_path && byPath[m.photo_path!]).map((m) => [m.id, byPath[m.photo_path!]])));
    } else setPhotos({});
  }, []);

  useEffect(() => {
    const sb = getSupabase();
    let channel: ReturnType<typeof sb.channel> | null = null;
    (async () => {
      const { data: auth } = await sb.auth.getUser();
      const { data: mine } = await sb.from("members").select("*").eq("user_id", auth.user?.id ?? "").maybeSingle();
      if (!mine) {
        setError("This login isn't linked to a household member.");
        return;
      }
      setMeId(mine.id);
      const { data: hh } = await sb.from("households").select("*").eq("id", mine.household_id).single();
      setHousehold(hh as Household);
      await loadMembers(mine.household_id);
      channel = sb
        .channel(`members-${mine.household_id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "members", filter: `household_id=eq.${mine.household_id}` }, () =>
          void loadMembers(mine.household_id),
        )
        .subscribe();
    })();
    return () => {
      if (channel) sb.removeChannel(channel);
    };
  }, [loadMembers]);

  const updateMember = useCallback(
    async (id: string, patch: Partial<Member>) => {
      setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
      await getSupabase().from("members").update(patch).eq("id", id);
    },
    [],
  );

  const uploadPhoto = useCallback(
    async (member: Member, file: File) => {
      if (!household) return;
      const blob = await squareJpeg(file, 320);
      const sb = getSupabase();
      const path = `${household.id}/${member.id}-${Date.now()}.jpg`;
      const { error } = await sb.storage.from("avatars").upload(path, blob, { contentType: "image/jpeg" });
      if (error) throw error;
      if (member.photo_path) await sb.storage.from("avatars").remove([member.photo_path]);
      await sb.from("members").update({ photo_path: path }).eq("id", member.id);
      await loadMembers(household.id);
    },
    [household, loadMembers],
  );

  const removePhoto = useCallback(
    async (member: Member) => {
      if (!household || !member.photo_path) return;
      const sb = getSupabase();
      await sb.storage.from("avatars").remove([member.photo_path]);
      await sb.from("members").update({ photo_path: null }).eq("id", member.id);
      await loadMembers(household.id);
    },
    [household, loadMembers],
  );

  const me = members.find((m) => m.id === meId) ?? null;
  return { household, members, me, photos, error, updateMember, uploadPhoto, removePhoto };
}

// Crop to a centred square and shrink, so photos stay small
async function squareJpeg(file: File, size: number): Promise<Blob> {
  const img = await createImageBitmap(file);
  const side = Math.min(img.width, img.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  canvas.getContext("2d")!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("photo"))), "image/jpeg", 0.85));
}

export type EventDraft = {
  id?: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  rrule: string | null;
  location: string | null;
  notes: string | null;
  memberIds: string[];
};

export function useWeek(householdId: string | null, weekStart: Date) {
  const [events, setEvents] = useState<PlannerEvent[]>([]);
  const [dinners, setDinners] = useState<Dinner[]>([]);
  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const from = days[0].iso;
  const to = days[6].iso;

  const load = useCallback(async () => {
    if (!householdId) return;
    const sb = getSupabase();
    const start = new Date(`${from}T00:00:00`);
    const end = addDays(start, 7);
    const [{ data: ev }, { data: dn }] = await Promise.all([
      sb
        .from("events")
        .select("id,title,starts_at,ends_at,all_day,rrule,location,notes,event_members(member_id)")
        .eq("household_id", householdId)
        .lt("starts_at", end.toISOString())
        .or(`rrule.not.is.null,starts_at.gte.${start.toISOString()},ends_at.gte.${start.toISOString()}`)
        .order("starts_at"),
      sb.from("meal_plan").select("id,date,note,recipe_id,recipes(title)").eq("household_id", householdId).gte("date", from).lte("date", to),
    ]);
    setEvents((ev ?? []) as unknown as PlannerEvent[]);
    setDinners((dn ?? []) as unknown as Dinner[]);
  }, [householdId, from, to]);

  useEffect(() => {
    if (!householdId) return;
    void load();
    const sb = getSupabase();
    const channel = sb
      .channel(`week-${householdId}-${from}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "events", filter: `household_id=eq.${householdId}` }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "event_members" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "meal_plan", filter: `household_id=eq.${householdId}` }, () => void load())
      .subscribe();
    const timer = setInterval(() => void load(), 10 * 60 * 1000);
    const onVisible = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      sb.removeChannel(channel);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [householdId, from, load]);

  const occurrences = useMemo(() => occurrencesBetween(events, from, to), [events, from, to]);

  const saveEvent = useCallback(
    async (draft: EventDraft) => {
      if (!householdId) return;
      const sb = getSupabase();
      const row = {
        household_id: householdId,
        title: draft.title.trim(),
        starts_at: draft.starts_at,
        ends_at: draft.ends_at,
        all_day: draft.all_day,
        rrule: draft.rrule,
        location: draft.location,
        notes: draft.notes,
      };
      const id = draft.id ?? crypto.randomUUID();
      const { error } = await sb.from("events").upsert({ id, ...row });
      if (error) throw error;
      await sb.from("event_members").delete().eq("event_id", id);
      if (draft.memberIds.length) await sb.from("event_members").insert(draft.memberIds.map((member_id) => ({ event_id: id, member_id })));
      await load();
    },
    [householdId, load],
  );

  const deleteEvent = useCallback(
    async (id: string) => {
      await getSupabase().from("events").delete().eq("id", id);
      await load();
    },
    [load],
  );

  // Remove one date from a repeating series
  const skipOccurrence = useCallback(
    async (event: PlannerEvent, date: Date) => {
      const rule = parseRule(event.rrule);
      if (!rule) return deleteEvent(event.id);
      rule.exDates = [...new Set([...rule.exDates, isoDay(date)])];
      await getSupabase().from("events").update({ rrule: formatRule(rule) }).eq("id", event.id);
      await load();
    },
    [deleteEvent, load],
  );

  const setDinnerNote = useCallback(
    async (date: string, note: string) => {
      if (!householdId) return;
      const sb = getSupabase();
      const text = note.trim();
      if (!text) await sb.from("meal_plan").delete().eq("household_id", householdId).eq("date", date);
      else await sb.from("meal_plan").upsert({ household_id: householdId, date, note: text, recipe_id: null }, { onConflict: "household_id,date" });
      await load();
    },
    [householdId, load],
  );

  return { days, occurrences, dinners, saveEvent, deleteEvent, skipOccurrence, setDinnerNote };
}
