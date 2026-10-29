"use client";

import { fmt, hhmm } from "@/lib/dates";
import type { DueReminder } from "@/lib/useReminders";
import type { Member } from "@/lib/types";
import { Avatar } from "./Avatar";

// "today", "tomorrow", "on Monday", "in 2 weeks", "on 3 Dec"
function howSoon(start: Date, now: Date) {
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const b = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const days = Math.round((b - a) / 864e5);
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  if (days < 7) return `on ${fmt(start, { weekday: "long" })}`;
  if (days < 28) return `in ${Math.round(days / 7)} week${Math.round(days / 7) === 1 ? "" : "s"}`;
  return `on ${fmt(start, { day: "numeric", month: "long" })}`;
}

// Reminder cards along the top of the screen, each with Snooze and Done
export function Reminders({ due, members, photos, onDone, onSnooze }: { due: DueReminder[]; members: Member[]; photos: Record<string, string>; onDone: (r: DueReminder) => void; onSnooze: (r: DueReminder) => void }) {
  if (!due.length) return null;
  return (
    <section className="reminders" aria-label="Reminders">
      {due.map((r) => {
        const o = r.occurrence;
        const who = members.filter((m) => o.memberIds.includes(m.id));
        const when = `${fmt(o.start, { weekday: "long", day: "numeric", month: "short" })}${o.event.all_day ? "" : `, ${hhmm(o.start)}`}`;
        return (
          <article key={r.key} className="reminder">
            <span className="reminder-bell" aria-hidden="true">🔔</span>
            <div className="reminder-text">
              <strong>{o.event.title} is {howSoon(o.start, new Date())}</strong>
              <span>{when}</span>
            </div>
            {who.length > 0 && who.length < members.length && (
              <span className="faces">{who.map((m) => <Avatar key={m.id} member={m} size={28} photoUrl={photos[m.id]} ring />)}</span>
            )}
            <button className="btn btn-quiet btn-small" onClick={() => onSnooze(r)} title="Show again tomorrow morning">Snooze</button>
            <button className="btn btn-primary btn-small" onClick={() => onDone(r)}>Done</button>
          </article>
        );
      })}
    </section>
  );
}
