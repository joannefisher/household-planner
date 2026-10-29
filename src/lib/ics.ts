// Writes the planner's events as an iCalendar file that the iPhone Calendar app can subscribe to.

import { addDaysToParts, compactDate, compactDateTime, zonedParts, zonedToUtc } from "./tz";

export type FeedEvent = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  rrule: string | null;
  location: string | null;
  notes: string | null;
  updated_at: string;
  members: string[];
};

export type Feed = {
  household: string;
  timezone: string;
  member: string | null;
  member_count: number;
  events: FeedEvent[];
};

const LONDON = [
  "BEGIN:VTIMEZONE",
  "TZID:Europe/London",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0000",
  "TZOFFSETTO:+0100",
  "TZNAME:BST",
  "DTSTART:19700329T010000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0000",
  "TZNAME:GMT",
  "DTSTART:19701025T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

export function escapeText(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

// Lines longer than 75 bytes continue on the next line after a space
export function fold(line: string) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74;
    if (bytes + b > limit) {
      out.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join("\r\n ");
}

const utcStamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

function eventLines(e: FeedEvent, feed: Feed, host: string): string[] {
  const tz = feed.timezone || "Europe/London";
  const useTzid = tz === "Europe/London";
  const start = new Date(e.starts_at);
  const end = e.ends_at ? new Date(e.ends_at) : start;
  const lines = ["BEGIN:VEVENT", `UID:${e.id}@${host}`, `DTSTAMP:${utcStamp(new Date(e.updated_at))}`, `LAST-MODIFIED:${utcStamp(new Date(e.updated_at))}`];

  const startLocal = zonedParts(start, tz);
  const timeOf = (d: Date) => (useTzid ? `;TZID=${tz}:${compactDateTime(zonedParts(d, tz))}` : `:${utcStamp(d)}`);

  if (e.all_day) {
    // Stored as midnight on the first and last day; iCalendar wants the day after the last
    const last = zonedParts(end, tz);
    const after = addDaysToParts(compactDate(last) < compactDate(startLocal) ? startLocal : last, 1);
    lines.push(`DTSTART;VALUE=DATE:${compactDate(startLocal)}`, `DTEND;VALUE=DATE:${compactDate(after)}`);
  } else {
    const realEnd = end.getTime() > start.getTime() ? end : new Date(start.getTime() + 60 * 60 * 1000);
    lines.push(`DTSTART${timeOf(start)}`, `DTEND${timeOf(realEnd)}`);
  }

  const rule = toIcsRule(e.rrule, e.all_day, startLocal, tz, useTzid);
  if (rule) {
    lines.push(`RRULE:${rule.rrule}`);
    if (rule.exdates.length) {
      const param = e.all_day ? ";VALUE=DATE" : useTzid ? `;TZID=${tz}` : "";
      lines.push(`EXDATE${param}:${rule.exdates.join(",")}`);
    }
  }

  // On the family calendar, say who it's for unless it's everyone
  const everyone = e.members.length === 0 || e.members.length >= feed.member_count;
  const who = everyone ? "" : e.members.join(", ");
  const summary = !feed.member && who ? `${e.title} (${who})` : e.title;
  lines.push(`SUMMARY:${escapeText(summary)}`);
  if (e.location) lines.push(`LOCATION:${escapeText(e.location)}`);
  const desc = [everyone ? "Everyone" : `Who: ${who}`, e.notes ?? ""].filter(Boolean).join("\n");
  lines.push(`DESCRIPTION:${escapeText(desc)}`);
  lines.push("END:VEVENT");
  return lines;
}

// Our rule FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH;UNTIL=20270131;EXDATE=20261105 has dates
// in household time; iCalendar wants UNTIL in UTC for timed events and EXDATE at the start time.
export function toIcsRule(rrule: string | null, allDay: boolean, startLocal: ReturnType<typeof zonedParts>, tz: string, useTzid: boolean) {
  if (!rrule) return null;
  const parts = Object.fromEntries(rrule.split(";").map((p) => p.split("=") as [string, string]));
  if (!parts.FREQ || !["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(parts.FREQ)) return null;
  const bits = [`FREQ=${parts.FREQ}`];
  if (parts.INTERVAL && Number(parts.INTERVAL) > 1) bits.push(`INTERVAL=${Number(parts.INTERVAL)}`);
  if (parts.FREQ === "WEEKLY" && parts.BYDAY) bits.push(`BYDAY=${parts.BYDAY}`);
  if (parts.UNTIL && /^\d{8}$/.test(parts.UNTIL)) {
    if (allDay) bits.push(`UNTIL=${parts.UNTIL}`);
    else {
      const y = +parts.UNTIL.slice(0, 4), m = +parts.UNTIL.slice(4, 6), d = +parts.UNTIL.slice(6, 8);
      bits.push(`UNTIL=${utcStamp(zonedToUtc({ y, m, d, h: 23, mi: 59, s: 59 }, tz))}`);
    }
  }
  const exdates = (parts.EXDATE ? parts.EXDATE.split(",") : [])
    .filter((x) => /^\d{8}$/.test(x))
    .map((x) => {
      if (allDay) return x;
      const p = { y: +x.slice(0, 4), m: +x.slice(4, 6), d: +x.slice(6, 8), h: startLocal.h, mi: startLocal.mi, s: 0 };
      return useTzid ? compactDateTime(p) : utcStamp(zonedToUtc(p, tz));
    });
  return { rrule: bits.join(";"), exdates };
}

export function buildCalendar(feed: Feed, host: string) {
  const name = feed.member ? `${feed.member} (${feed.household})` : feed.household;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Fisher-Oakley//Household planner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(name)}`,
    `X-WR-TIMEZONE:${feed.timezone || "Europe/London"}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    ...(feed.timezone === "Europe/London" || !feed.timezone ? LONDON : []),
    ...feed.events.flatMap((e) => eventLines(e, { ...feed, timezone: feed.timezone || "Europe/London" }, host)),
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
