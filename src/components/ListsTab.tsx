"use client";

import type { Member } from "@/lib/types";
import { TodoPanel } from "./TodoPanel";

// The phone "Lists" tab
export function ListsTab({ householdId, members, photos, me }: { householdId: string; members: Member[]; photos: Record<string, string>; me: Member | null }) {
  return <TodoPanel householdId={householdId} members={members} photos={photos} me={me} />;
}
