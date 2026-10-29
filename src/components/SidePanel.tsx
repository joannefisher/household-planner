"use client";

import { useEffect, useState } from "react";
import type { Member } from "@/lib/types";
import { TodoPanel } from "./TodoPanel";

const VIEW_KEY = "planner.sidePanel";

// The kitchen screen's right-hand panel: the shopping list, or the to-do lists.
// Wishlists never appear here, so present ideas stay off the shared screen.
export function SidePanel({ shopping, householdId, members, photos, me }: { shopping: React.ReactNode; householdId: string; members: Member[]; photos: Record<string, string>; me: Member | null }) {
  const [view, setView] = useState<"shopping" | "lists">("shopping");
  useEffect(() => {
    try {
      if (localStorage.getItem(VIEW_KEY) === "lists") setView("lists");
    } catch {}
  }, []);
  const choose = (v: "shopping" | "lists") => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {}
  };

  return (
    <div className="side-panel">
      <div className="seg" role="tablist" aria-label="Panel">
        <button role="tab" aria-selected={view === "shopping"} className={view === "shopping" ? "is-on" : ""} onClick={() => choose("shopping")}>Shopping</button>
        <button role="tab" aria-selected={view === "lists"} className={view === "lists" ? "is-on" : ""} onClick={() => choose("lists")}>Lists</button>
      </div>
      {view === "shopping" ? shopping : <TodoPanel householdId={householdId} members={members} photos={photos} me={me} />}
    </div>
  );
}
