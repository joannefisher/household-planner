"use client";

import { useEffect, useState } from "react";
import type { Member } from "@/lib/types";
import { TodoPanel } from "./TodoPanel";
import { WishlistPanel } from "./WishlistPanel";

const VIEW_KEY = "planner.listsView";

// The phone "Lists" tab: to-dos, plus gift ideas for signed-in grown-ups.
// The kitchen screen never renders this (it uses SidePanel), so present ideas stay off it.
export function ListsTab({ householdId, members, photos, me }: { householdId: string; members: Member[]; photos: Record<string, string>; me: Member | null }) {
  const adult = me?.role === "adult";
  const [view, setView] = useState<"todos" | "gifts">("todos");
  useEffect(() => {
    try {
      if (localStorage.getItem(VIEW_KEY) === "gifts") setView("gifts");
    } catch {}
  }, []);
  const choose = (v: "todos" | "gifts") => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {}
  };

  if (!adult) return <TodoPanel householdId={householdId} members={members} photos={photos} me={me} />;
  return (
    <div className="lists-tab">
      <div className="seg" role="tablist" aria-label="Lists">
        <button role="tab" aria-selected={view === "todos"} className={view === "todos" ? "is-on" : ""} onClick={() => choose("todos")}>To-dos</button>
        <button role="tab" aria-selected={view === "gifts"} className={view === "gifts" ? "is-on" : ""} onClick={() => choose("gifts")}>Gift ideas</button>
      </div>
      {view === "todos" ? (
        <TodoPanel householdId={householdId} members={members} photos={photos} me={me} />
      ) : (
        <WishlistPanel householdId={householdId} members={members} photos={photos} me={me} />
      )}
    </div>
  );
}
