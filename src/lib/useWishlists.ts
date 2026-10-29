"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { splitPieces } from "@/lib/parse";

export type Wishlist = { id: string; household_id: string; name: string; for_member_id: string | null; occasion_date: string | null; sort_order: number; created_at: string };
export type WishItem = {
  id: string;
  wishlist_id: string;
  household_id: string;
  title: string;
  link: string | null;
  price: number | null;
  notes: string | null;
  bought: boolean;
  bought_by: string | null;
  created_by: string | null;
  created_at: string;
};

// Gift ideas. Only loaded on adults' phones, never on the kitchen screen.
export function useWishlists(householdId: string | null) {
  const [lists, setLists] = useState<Wishlist[]>([]);
  const [items, setItems] = useState<WishItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!householdId) return;
    const sb = getSupabase();
    const [{ data: l }, { data: i }] = await Promise.all([
      sb.from("wishlists").select("*").eq("household_id", householdId).order("sort_order").order("created_at"),
      sb.from("wishlist_items").select("*").eq("household_id", householdId).order("created_at"),
    ]);
    if (l) setLists(l as Wishlist[]);
    if (i) setItems((i as WishItem[]).map((x) => ({ ...x, price: x.price == null ? null : Number(x.price) })));
    setLoaded(true);
  }, [householdId]);

  useEffect(() => {
    if (!householdId) return;
    void load();
    const sb = getSupabase();
    const soon = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void load(), 250);
    };
    const channel = sb
      .channel(`wishlists-${householdId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "wishlists", filter: `household_id=eq.${householdId}` }, soon)
      .on("postgres_changes", { event: "*", schema: "public", table: "wishlist_items", filter: `household_id=eq.${householdId}` }, soon)
      .subscribe();
    const onVisible = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      sb.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [householdId, load]);

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

  const addList = useCallback(
    (patch: Pick<Wishlist, "name" | "for_member_id" | "occasion_date">) => {
      if (!householdId) return null;
      const row: Wishlist = {
        id: crypto.randomUUID(),
        household_id: householdId,
        ...patch,
        sort_order: lists.length ? Math.max(...lists.map((l) => l.sort_order)) + 1 : 0,
        created_at: new Date().toISOString(),
      };
      setLists((prev) => [...prev, row]);
      void save(() => getSupabase().from("wishlists").insert(row));
      return row.id;
    },
    [householdId, lists, save],
  );

  const updateList = useCallback(
    (id: string, patch: Partial<Pick<Wishlist, "name" | "for_member_id" | "occasion_date">>) => {
      setLists((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
      void save(() => getSupabase().from("wishlists").update(patch).eq("id", id));
    },
    [save],
  );

  const deleteList = useCallback(
    (id: string) => {
      setLists((prev) => prev.filter((l) => l.id !== id));
      setItems((prev) => prev.filter((i) => i.wishlist_id !== id));
      void save(() => getSupabase().from("wishlists").delete().eq("id", id));
    },
    [save],
  );

  const addText = useCallback(
    (wishlistId: string, text: string, createdBy: string | null) => {
      if (!householdId) return 0;
      const existing = items.filter((i) => i.wishlist_id === wishlistId);
      const rows: WishItem[] = splitPieces(text)
        .filter((t) => !existing.some((i) => i.title.toLowerCase() === t.toLowerCase()))
        .map((title) => ({
          id: crypto.randomUUID(),
          wishlist_id: wishlistId,
          household_id: householdId,
          title: title.slice(0, 300),
          link: null,
          price: null,
          notes: null,
          bought: false,
          bought_by: null,
          created_by: createdBy,
          created_at: new Date().toISOString(),
        }));
      if (!rows.length) return 0;
      setItems((prev) => [...prev, ...rows]);
      void save(() => getSupabase().from("wishlist_items").insert(rows));
      return rows.length;
    },
    [householdId, items, save],
  );

  const updateItem = useCallback(
    (id: string, patch: Partial<Omit<WishItem, "id" | "wishlist_id" | "household_id">>) => {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
      void save(() => getSupabase().from("wishlist_items").update(patch).eq("id", id));
    },
    [save],
  );

  const removeItem = useCallback(
    (id: string) => {
      setItems((prev) => prev.filter((i) => i.id !== id));
      void save(() => getSupabase().from("wishlist_items").delete().eq("id", id));
    },
    [save],
  );

  return { lists, items, loaded, error, addList, updateList, deleteList, addText, updateItem, removeItem };
}
