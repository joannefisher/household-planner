// Repeating events, stored in the events.rrule column in iCalendar style, e.g.
//   FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH;UNTIL=20270131;EXDATE=20261105,20261112
// EXDATE lists single dates that have been deleted from the series.

import { addDays, fromIsoDay, isoDay, minutesOfDay } from "./dates";
import type { Occurrence, PlannerEvent } from "./types";

export type Freq = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
export type Rule = { freq: Freq; interval: number; byDay: number[]; until: string | null; exDates: string[] };

export const WEEKDAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

const compact = (iso: string) => iso.replaceAll("-", "");
const expand = (c: string) => `${c.slice(0, 4)}-${c.slice(4, 6)}-${c.slice(6, 8)}`;
const mondayIndex = (d: Date) => (d.getDay() + 6) % 7;

export function parseRule(rrule: string | null): Rule | null {
  if (!rrule) return null;
  const parts = Object.fromEntries(rrule.split(";").map((p) => p.split("=") as [string, string]));
  if (!parts.FREQ) return null;
  return {
    freq: parts.FREQ as Freq,
    interval: Number(parts.INTERVAL ?? 1) || 1,
    byDay: parts.BYDAY ? parts.BYDAY.split(",").map((d) => WEEKDAYS.indexOf(d)).filter((i) => i >= 0) : [],
    until: parts.UNTIL ? expand(parts.UNTIL) : null,
    exDates: parts.EXDATE ? parts.EXDATE.split(",").map(expand) : [],
  };
}

export function formatRule(rule: Rule): string {
  const bits = [`FREQ=${rule.freq}`];
  if (rule.interval > 1) bits.push(`INTERVAL=${rule.interval}`);
  if (rule.freq === "WEEKLY" && rule.byDay.length) bits.push(`BYDAY=${rule.byDay.map((i) => WEEKDAYS[i]).join(",")}`);
  if (rule.until) bits.push(`UNTIL=${compact(rule.until)}`);
  if (rule.exDates.length) bits.push(`EXDATE=${rule.exDates.map(compact).join(",")}`);
  return bits.join(";");
}

export function describeRule(rule: Rule | null): string | null {
  if (!rule) return null;
  const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  let s =
    rule.freq === "DAILY" ? "Every day"
    : rule.freq === "WEEKLY" ? `${rule.interval === 2 ? "Every 2 weeks" : "Every week"}${rule.byDay.length ? ` on ${rule.byDay.map((i) => names[i]).join(", ")}` : ""}`
    : rule.freq === "MONTHLY" ? "Every month"
    : "Every year";
  if (rule.until) s += ` until ${fromIsoDay(rule.until).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
  return s;
}

function matches(rule: Rule, first: Date, day: Date) {
  const days = Math.round((day.getTime() - first.getTime()) / 864e5);
  switch (rule.freq) {
    case "DAILY":
      return days % rule.interval === 0;
    case "WEEKLY": {
      const byDay = rule.byDay.length ? rule.byDay : [mondayIndex(first)];
      if (!byDay.includes(mondayIndex(day))) return false;
      const weeks = Math.round((addDays(day, -mondayIndex(day)).getTime() - addDays(first, -mondayIndex(first)).getTime()) / (7 * 864e5));
      return weeks % rule.interval === 0;
    }
    case "MONTHLY": {
      const months = (day.getFullYear() - first.getFullYear()) * 12 + day.getMonth() - first.getMonth();
      return day.getDate() === first.getDate() && months % rule.interval === 0;
    }
    case "YEARLY":
      return day.getDate() === first.getDate() && day.getMonth() === first.getMonth();
  }
}

// Every appearance of the events between two dates (inclusive), as local times
export function occurrencesBetween(events: PlannerEvent[], fromIso: string, toIso: string): Occurrence[] {
  const out: Occurrence[] = [];
  const from = fromIsoDay(fromIso);
  const to = fromIsoDay(toIso);

  for (const event of events) {
    const start = new Date(event.starts_at);
    const end = event.ends_at ? new Date(event.ends_at) : start;
    const memberIds = event.event_members.map((m) => m.member_id);
    const rule = parseRule(event.rrule);

    if (!rule) {
      if (isoDay(start) <= toIso && isoDay(end) >= fromIso) {
        out.push({ key: event.id, event, start, end, memberIds });
      }
      continue;
    }

    const firstDay = fromIsoDay(isoDay(start));
    const length = end.getTime() - start.getTime();
    const startMinutes = minutesOfDay(start);
    for (let day = new Date(from); day <= to; day = addDays(day, 1)) {
      const iso = isoDay(day);
      if (day < firstDay || (rule.until && iso > rule.until) || rule.exDates.includes(iso)) continue;
      if (!matches(rule, firstDay, day)) continue;
      const s = fromIsoDay(iso, Math.floor(startMinutes / 60), startMinutes % 60);
      out.push({ key: `${event.id}:${iso}`, event, start: s, end: new Date(s.getTime() + length), memberIds });
    }
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}
