"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { parseItems } from "@/lib/parse";
import type { ShoppingItem } from "@/lib/types";

// The list updates on screen straight away, saves to Supabase in the background,
// and keeps any change made without signal in a queue until the connection returns.

type Op =
  | { kind: "upsert"; item: ShoppingItem }
  | { kind: "update"; id: string; patch: Partial<ShoppingItem> }
  | { kind: "delete"; id: string };

const CACHE_KEY = "planner.list.cache";
const QUEUE_KEY = "planner.list.queue";

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

// Chrome says "Failed to fetch", Safari says "Load failed"
function isNetworkError(message: string) {
  return !navigator.onLine || /fetch|load failed|network/i.test(message);
}

function applyOp(items: ShoppingItem[], op: Op): ShoppingItem[] {
  if (op.kind === "upsert") return [...items.filter((i) => i.id !== op.item.id), op.item];
  if (op.kind === "update") return items.map((i) => (i.id === op.id ? { ...i, ...op.patch } : i));
  return items.filter((i) => i.id !== op.id);
}

export function useShoppingList(householdId: string | null) {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(true);
  const queue = useRef<Op[]>([]);
  const flushing = useRef(false);

  const commit = useCallback((next: ShoppingItem[]) => {
    save(CACHE_KEY, next);
    return next;
  }, []);

  const flush = useCallback(async () => {
    if (flushing.current || queue.current.length === 0) return;
    flushing.current = true;
    const sb = getSupabase();
    try {
      while (queue.current.length) {
        const op = queue.current[0];
        let error;
        if (op.kind === "upsert") ({ error } = await sb.from("shopping_items").upsert(op.item));
        else if (op.kind === "update") ({ error } = await sb.from("shopping_items").update(op.patch).eq("id", op.id));
        else ({ error } = await sb.from("shopping_items").delete().eq("id", op.id));
        if (error && isNetworkError(error.message)) break;
        queue.current.shift(); // saved, or rejected for good: either way drop it
        save(QUEUE_KEY, queue.current);
        setPending(queue.current.length);
      }
    } catch {
      /* offline: keep the queue for later */
    } finally {
      flushing.current = false;
      setPending(queue.current.length);
    }
  }, []);

  const enqueue = useCallback(
    (op: Op) => {
      queue.current.push(op);
      save(QUEUE_KEY, queue.current);
      setPending(queue.current.length);
      setItems((prev) => commit(applyOp(prev, op)));
      void flush();
    },
    [commit, flush],
  );

  // Initial load, live updates and reconnect handling
  useEffect(() => {
    if (!householdId) return;
    queue.current = load<Op[]>(QUEUE_KEY, []);
    setPending(queue.current.length);
    setItems(load<ShoppingItem[]>(CACHE_KEY, []));

    const sb = getSupabase();
    const refresh = async () => {
      const { data, error } = await sb.from("shopping_items").select("*").eq("household_id", householdId);
      if (error || !data) return;
      // Server copy, with any unsaved local changes laid on top
      setItems(commit(queue.current.reduce(applyOp, data as ShoppingItem[])));
    };
    void refresh().then(flush);

    const channel = sb
      .channel(`list-${householdId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shopping_items", filter: `household_id=eq.${householdId}` },
        (payload) => {
          setItems((prev) => {
            if (payload.eventType === "DELETE") return commit(prev.filter((i) => i.id !== (payload.old as ShoppingItem).id));
            return commit(applyOp(prev, { kind: "upsert", item: payload.new as ShoppingItem }));
          });
        },
      )
      .subscribe();

    const goOnline = () => {
      setOnline(true);
      void refresh().then(flush);
    };
    const goOffline = () => setOnline(false);
    const onVisible = () => document.visibilityState === "visible" && goOnline();
    setOnline(navigator.onLine);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(() => void flush(), 15000);

    return () => {
      sb.removeChannel(channel);
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, [householdId, commit, flush]);

  const addText = useCallback(
    (text: string, addedBy: string | null) => {
      if (!householdId) return 0;
      let added = 0;
      for (const p of parseItems(text)) {
        const same = items.find((i) => i.name.toLowerCase() === p.name.toLowerCase());
        if (same && !same.checked) continue; // already on the list
        if (same) {
          enqueue({ kind: "update", id: same.id, patch: { checked: false, checked_at: null, added_by: addedBy, quantity: p.quantity ?? same.quantity, unit: p.unit ?? same.unit } });
        } else {
          enqueue({
            kind: "upsert",
            item: {
              id: crypto.randomUUID(),
              household_id: householdId,
              name: p.name,
              quantity: p.quantity,
              unit: p.unit,
              aisle: p.aisle,
              checked: false,
              checked_at: null,
              usual: false,
              meal_plan_id: null,
              added_by: addedBy,
              created_at: new Date().toISOString(),
            },
          });
        }
        added++;
      }
      return added;
    },
    [householdId, items, enqueue],
  );

  const toggle = useCallback(
    (item: ShoppingItem) =>
      enqueue({
        kind: "update",
        id: item.id,
        patch: item.checked ? { checked: false, checked_at: null } : { checked: true, checked_at: new Date().toISOString() },
      }),
    [enqueue],
  );

  const update = useCallback((id: string, patch: Partial<ShoppingItem>) => enqueue({ kind: "update", id, patch }), [enqueue]);
  const remove = useCallback((id: string) => enqueue({ kind: "delete", id }), [enqueue]);

  // Ticked items leave the list; usuals stay behind as one-tap re-adds
  const clearTicked = useCallback(() => {
    for (const i of items) {
      if (!i.checked || !i.checked_at) continue;
      if (i.usual) enqueue({ kind: "update", id: i.id, patch: { checked_at: null } });
      else enqueue({ kind: "delete", id: i.id });
    }
  }, [items, enqueue]);

  return { items, pending, online, addText, toggle, update, remove, clearTicked };
}
