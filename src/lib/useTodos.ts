"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { splitPieces } from "@/lib/parse";

export type TodoList = {
  id: string;
  household_id: string;
  name: string;
  emoji: string | null;
  colour: string | null;
  sort_order: number;
  created_at: string;
  // Grown-up lists are plain; kids' lists get a theme, stickers and celebrations
  kind: "adult" | "kids";
  theme: string | null;
  owner: string | null;
};
export type TodoItem = {
  id: string;
  list_id: string;
  household_id: string;
  title: string;
  done: boolean;
  done_at: string | null;
  assignee: string | null;
  due_date: string | null;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  sticker: string | null;
};

// To-do lists, shared live between the kitchen screen and phones.
// Changes show straight away and save in the background.
export function useTodos(householdId: string | null) {
  const [lists, setLists] = useState<TodoList[]>([]);
  const [items, setItems] = useState<TodoItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!householdId) return;
    const sb = getSupabase();
    const [{ data: l }, { data: i }] = await Promise.all([
      sb.from("todo_lists").select("*").eq("household_id", householdId).order("sort_order").order("created_at"),
      sb.from("todo_items").select("*").eq("household_id", householdId).order("sort_order").order("created_at"),
    ]);
    if (l) setLists(l as TodoList[]);
    if (i) setItems(i as TodoItem[]);
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
      .channel(`todos-${householdId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "todo_lists", filter: `household_id=eq.${householdId}` }, soon)
      .on("postgres_changes", { event: "*", schema: "public", table: "todo_items", filter: `household_id=eq.${householdId}` }, soon)
      .subscribe();
    const onVisible = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      sb.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [householdId, load]);

  // Run a save; if it fails, show a note and reload the real state
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
    (name: string, emoji: string | null, extra: Partial<Pick<TodoList, "kind" | "theme" | "owner">> = {}) => {
      if (!householdId) return null;
      const row: TodoList = {
        id: crypto.randomUUID(),
        household_id: householdId,
        name: name.trim().slice(0, 80),
        emoji,
        colour: null,
        kind: extra.kind ?? "adult",
        theme: extra.theme ?? null,
        owner: extra.owner ?? null,
        sort_order: lists.length ? Math.max(...lists.map((l) => l.sort_order)) + 1 : 0,
        created_at: new Date().toISOString(),
      };
      setLists((prev) => [...prev, row]);
      void save(() => getSupabase().from("todo_lists").insert(row));
      return row.id;
    },
    [householdId, lists, save],
  );

  const updateList = useCallback(
    (id: string, patch: Partial<Pick<TodoList, "name" | "emoji" | "kind" | "theme" | "owner">>) => {
      setLists((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
      void save(() => getSupabase().from("todo_lists").update(patch).eq("id", id));
    },
    [save],
  );

  const deleteList = useCallback(
    (id: string) => {
      setLists((prev) => prev.filter((l) => l.id !== id));
      setItems((prev) => prev.filter((i) => i.list_id !== id));
      void save(() => getSupabase().from("todo_lists").delete().eq("id", id));
    },
    [save],
  );

  const addText = useCallback(
    (listId: string, text: string, createdBy: string | null) => {
      if (!householdId) return 0;
      const existing = items.filter((i) => i.list_id === listId);
      let order = existing.length ? Math.max(...existing.map((i) => i.sort_order)) + 1 : 0;
      const rows: TodoItem[] = splitPieces(text)
        .filter((t) => !existing.some((i) => !i.done && i.title.toLowerCase() === t.toLowerCase()))
        .map((title) => ({
          id: crypto.randomUUID(),
          list_id: listId,
          household_id: householdId,
          title: title.slice(0, 300),
          done: false,
          done_at: null,
          assignee: null,
          due_date: null,
          sort_order: order++,
          created_by: createdBy,
          created_at: new Date().toISOString(),
          sticker: null,
        }));
      if (!rows.length) return 0;
      setItems((prev) => [...prev, ...rows]);
      void save(() => getSupabase().from("todo_items").insert(rows));
      return rows.length;
    },
    [householdId, items, save],
  );

  const updateItem = useCallback(
    (id: string, patch: Partial<Pick<TodoItem, "title" | "done" | "done_at" | "assignee" | "due_date" | "sticker">>) => {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
      void save(() => getSupabase().from("todo_items").update(patch).eq("id", id));
    },
    [save],
  );

  const toggle = useCallback(
    (item: TodoItem) => updateItem(item.id, item.done ? { done: false, done_at: null } : { done: true, done_at: new Date().toISOString() }),
    [updateItem],
  );

  const removeItem = useCallback(
    (id: string) => {
      setItems((prev) => prev.filter((i) => i.id !== id));
      void save(() => getSupabase().from("todo_items").delete().eq("id", id));
    },
    [save],
  );

  const clearDone = useCallback(
    (listId: string) => {
      const ids = items.filter((i) => i.list_id === listId && i.done).map((i) => i.id);
      if (!ids.length) return;
      setItems((prev) => prev.filter((i) => !ids.includes(i.id)));
      void save(() => getSupabase().from("todo_items").delete().in("id", ids));
    },
    [items, save],
  );

  return { lists, items, loaded, error, addList, updateList, deleteList, addText, updateItem, toggle, removeItem, clearDone };
}
