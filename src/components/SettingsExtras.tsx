"use client";

import { useState } from "react";
import type { Household, Member } from "@/lib/types";
import { CalendarFeedSheet } from "./CalendarFeedSheet";
import { CoziImportSheet } from "./CoziImportSheet";
import { SiriSheet } from "./SiriSheet";

type Which = "feeds" | "cozi" | "siri" | null;

// Extra settings shown in the family sheet, each opening its own sheet on top.
export function SettingsExtras({
  household,
  members,
  me,
  photos,
  onOpenDinners,
}: {
  household: Household;
  members: Member[];
  me: Member | null;
  photos: Record<string, string>;
  onOpenDinners?: () => void;
}) {
  const [open, setOpen] = useState<Which>(null);
  const adult = me?.role === "adult";
  if (!adult) return null;

  const items: { key: Exclude<Which, null> | "dinners"; icon: string; label: string; hint: string }[] = [
    ...(onOpenDinners ? [{ key: "dinners" as const, icon: "🍝", label: "Dinners and recipes", hint: "Recipes, the week's shopping and staples" }] : []),
    { key: "siri", icon: "🎙️", label: "Siri shortcuts", hint: "Add to the list and ask about dinner by voice" },
    { key: "feeds", icon: "📆", label: "Calendar on your iPhone", hint: "See the planner in the Calendar app" },
    { key: "cozi", icon: "📥", label: "Bring events over from Cozi", hint: "A one-time copy of your Cozi calendar" },
  ];

  return (
    <div className="extras">
      <h3 className="me-label">More</h3>
      <ul className="fx-rows">
        {items.map((i) => (
          <li key={i.key}>
            <button type="button" className="fx-row fx-link" onClick={() => (i.key === "dinners" ? onOpenDinners?.() : setOpen(i.key))}>
              <span className="fx-icon" aria-hidden="true">{i.icon}</span>
              <span className="fx-row-text">
                <strong>{i.label}</strong>
                <span className="fx-sub">{i.hint}</span>
              </span>
              <span className="fx-chev" aria-hidden="true">›</span>
            </button>
          </li>
        ))}
      </ul>
      <CalendarFeedSheet open={open === "feeds"} onClose={() => setOpen(null)} householdId={household.id} members={members} photos={photos} />
      <CoziImportSheet open={open === "cozi"} onClose={() => setOpen(null)} />
      {me && <SiriSheet open={open === "siri"} onClose={() => setOpen(null)} householdId={household.id} me={me} />}
    </div>
  );
}
