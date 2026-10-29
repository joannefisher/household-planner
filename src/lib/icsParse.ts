// Reads an iCalendar file (e.g. a Cozi shared calendar) into planner events.
// Repeats become our rule format (FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH;UNTIL=20270131;EXDATE=20261105).
// "First Monday of the month" style repeats, which the planner can't store, are written out as separate dates.

import { addDaysToParts, compactDate, zonedParts, zonedToUtc, type Parts } from "./tz";

export type ImportedEvent = {
  uid: string;
  title: string;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  rrule: string | null;
  location: string | null;
  notes: string | null;
  who: string[];
};

export type ParseResult = { events: ImportedEvent[]; skippedOld: number; simplified: number };

type Prop = { name: string; params: Record<string, string>; value: string };
type Day = { y: number; m: number; d: number };

const WEEKDAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

export function unescapeText(s: string) {
  return s.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1").trim();
}

function parseProp(line: string): Prop | null {
  let inQuote = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuote = !inQuote;
    else if (c === ":" && !inQuote) {
      colon = i;
      break;
    }
  }
  if (colon < 0) return null;
  const [name, ...rawParams] = line.slice(0, colon).split(";");
  const params: Record<string, string> = {};
  for (const p of rawParams) {
    const eq = p.indexOf("=");
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name: name.toUpperCase(), params, value: line.slice(colon + 1) };
}

function validZone(tz: string | undefined) {
  if (!tz) return null;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return tz;
  } catch {
    return null;
  }
}

type When = { date: Day; instant: Date | null }; // instant is null for all-day values

function parseWhen(value: string, params: Record<string, string>, tz: string): When | null {
  const v = value.trim();
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const date = { y: +m[1], m: +m[2], d: +m[3] };
  if (params.VALUE === "DATE" || m[4] === undefined) return { date, instant: null };
  const p: Parts = { ...date, h: +m[4], mi: +m[5], s: +(m[6] ?? 0) };
  if (m[7]) return { date, instant: new Date(Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s)) };
  return { date, instant: zonedToUtc(p, validZone(params.TZID) ?? tz) };
}

function parseDuration(v: string) {
  const m = v.match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return 0;
  const ms = (((+(m[2] ?? 0) * 7 + +(m[3] ?? 0)) * 24 + +(m[4] ?? 0)) * 60 + +(m[5] ?? 0)) * 60000 + +(m[6] ?? 0) * 1000;
  return m[1] === "-" ? -ms : ms;
}

const dayKey = (d: Day) => compactDate(d);
const dow = (d: Day) => (new Date(Date.UTC(d.y, d.m - 1, d.d)).getUTCDay() + 6) % 7; // Monday = 0
const dayNumber = (d: Day) => Math.round(Date.UTC(d.y, d.m - 1, d.d) / 864e5);
const localDay = (when: When, tz: string): Day => (when.instant ? zonedParts(when.instant, tz) : when.date);

type Rule = { freq: string; interval: number; byDay: number[]; until: Day | null; count: number | null; nth: { n: number; day: number } | null };

function matches(rule: Rule, first: Day, day: Day) {
  const diff = dayNumber(day) - dayNumber(first);
  switch (rule.freq) {
    case "DAILY":
      return diff % rule.interval === 0;
    case "WEEKLY": {
      const byDay = rule.byDay.length ? rule.byDay : [dow(first)];
      if (!byDay.includes(dow(day))) return false;
      const weeks = Math.round((dayNumber(day) - dow(day) - (dayNumber(first) - dow(first))) / 7);
      return weeks % rule.interval === 0;
    }
    case "MONTHLY": {
      const months = (day.y - first.y) * 12 + day.m - first.m;
      return day.d === first.d && months % rule.interval === 0;
    }
    default:
      return day.d === first.d && day.m === first.m && (day.y - first.y) % rule.interval === 0;
  }
}

// The date of the COUNT-th repeat, so it can be stored as an end date
function lastOfCount(rule: Rule, first: Day): Day {
  let seen = 0;
  let day = first;
  for (let i = 0; i < 366 * 30; i++, day = addDaysToParts(first, i)) {
    if (matches(rule, first, day) && ++seen >= (rule.count ?? 1)) return day;
  }
  return day;
}

function nthWeekday(y: number, m: number, n: number, weekday: number): Day | null {
  if (n > 0) {
    const first = { y, m, d: 1 };
    const d = 1 + ((weekday - dow(first) + 7) % 7) + (n - 1) * 7;
    const r = { y, m, d };
    return addDaysToParts(r, 0).m === m ? r : null;
  }
  const last = addDaysToParts({ y: m === 12 ? y + 1 : y, m: m === 12 ? 1 : m + 1, d: 1 }, -1);
  const d = last.d - ((dow(last) - weekday + 7) % 7) + (n + 1) * 7;
  return d >= 1 ? { y, m, d } : null;
}

function parseRule(value: string, tz: string): Rule | "unsupported" {
  const parts = Object.fromEntries(value.split(";").map((p) => p.split("=") as [string, string]));
  const freq = parts.FREQ;
  if (!["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(freq)) return "unsupported";
  if (parts.BYSETPOS || parts.BYYEARDAY || parts.BYWEEKNO || parts.BYHOUR || parts.BYMINUTE) return "unsupported";
  const interval = Math.max(1, Number(parts.INTERVAL ?? 1) || 1);
  let until: Day | null = null;
  if (parts.UNTIL) {
    const w = parseWhen(parts.UNTIL, {}, tz);
    if (w) until = localDay(w, tz);
  }
  const count = parts.COUNT ? Number(parts.COUNT) || null : null;
  const rawDays = parts.BYDAY ? parts.BYDAY.split(",") : [];
  const plain = rawDays.map((d) => WEEKDAYS.indexOf(d)).filter((i) => i >= 0);
  const rule: Rule = { freq, interval, byDay: [], until, count, nth: null };

  if (freq === "DAILY") {
    if (rawDays.length) {
      if (plain.length !== rawDays.length) return "unsupported";
      return { ...rule, freq: "WEEKLY", interval: 1, byDay: plain };
    }
    return rule;
  }
  if (freq === "WEEKLY") {
    if (plain.length !== rawDays.length) return "unsupported";
    return { ...rule, byDay: plain };
  }
  if (freq === "MONTHLY") {
    if (parts.BYMONTHDAY && parts.BYMONTHDAY.includes(",")) return "unsupported";
    if (rawDays.length === 0) return rule;
    const m = rawDays.length === 1 ? rawDays[0].match(/^([+-]?\d)(MO|TU|WE|TH|FR|SA|SU)$/) : null;
    if (!m) return "unsupported";
    return { ...rule, nth: { n: Number(m[1]), day: WEEKDAYS.indexOf(m[2]) } };
  }
  if (rawDays.length || (parts.BYMONTH && parts.BYMONTH.includes(","))) return "unsupported";
  return rule;
}

// Cozi and others put names in front of the title: "Millie: Swimming", "Joanne & Aiden - Dinner out"
function splitNames(title: string, names: string[]) {
  const lower = names.map((n) => n.toLowerCase());
  const m = title.match(/^([^:\-–]{2,60}?)\s*(?::|\s-\s|\s–\s)\s*(.+)$/);
  if (!m) return { title, who: [] as string[] };
  const pieces = m[1].split(/\s*(?:,|&|\band\b|\/|\+)\s*/i).map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (pieces.length && pieces.every((p) => lower.includes(p))) {
    return { title: m[2].trim(), who: pieces.map((p) => names[lower.indexOf(p)]) };
  }
  return { title, who: [] as string[] };
}

type Raw = { props: Prop[] };

export function parseIcs(text: string, opts: { timezone: string; memberNames: string[]; now?: Date; keepDays?: number; horizonMonths?: number }): ParseResult {
  const tz = validZone(opts.timezone) ?? "Europe/London";
  const now = opts.now ?? new Date();
  const oldest = addDaysToParts(zonedParts(now, tz), -(opts.keepDays ?? 365));
  const horizon = addDaysToParts(zonedParts(now, tz), 30 * (opts.horizonMonths ?? 18));

  const lines = text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
  const raws: Raw[] = [];
  let depth = 0;
  let cur: Raw | null = null;
  for (const line of lines) {
    const t = line.trimEnd();
    if (/^BEGIN:VEVENT$/i.test(t)) {
      cur = { props: [] };
      depth = 0;
      continue;
    }
    if (!cur) continue;
    if (/^END:VEVENT$/i.test(t)) {
      raws.push(cur);
      cur = null;
      continue;
    }
    if (/^BEGIN:/i.test(t)) depth++;
    else if (/^END:/i.test(t)) depth--;
    else if (depth === 0) {
      const p = parseProp(t);
      if (p) cur.props.push(p);
    }
  }

  const masters = new Map<string, ImportedEvent & { exdates: Set<string> }>();
  const singles: ImportedEvent[] = [];
  const overrides: { uid: string; day: string; cancelled: boolean; ev: ImportedEvent | null }[] = [];
  let skippedOld = 0;
  let simplified = 0;

  for (const raw of raws) {
    const get = (n: string) => raw.props.find((p) => p.name === n);
    const all = (n: string) => raw.props.filter((p) => p.name === n);
    const dtstart = get("DTSTART");
    if (!dtstart) continue;
    const start = parseWhen(dtstart.value, dtstart.params, tz);
    if (!start) continue;
    const cancelled = /CANCELLED/i.test(get("STATUS")?.value ?? "");
    const uid = get("UID")?.value.trim() || `${dtstart.value}-${get("SUMMARY")?.value ?? ""}`;
    const recurrenceId = get("RECURRENCE-ID");

    const allDay = start.instant === null;
    const firstDay = localDay(start, tz);
    let startsAt: Date;
    let endsAt: Date;
    if (allDay) {
      startsAt = zonedToUtc({ ...firstDay, h: 0, mi: 0, s: 0 }, tz);
      const dtend = get("DTEND");
      const endW = dtend ? parseWhen(dtend.value, dtend.params, tz) : null;
      let lastDay = endW ? addDaysToParts(endW.date, -1) : firstDay;
      const dur = get("DURATION");
      if (!endW && dur) lastDay = addDaysToParts(firstDay, Math.max(0, Math.round(parseDuration(dur.value) / 864e5) - 1));
      if (dayKey(lastDay) < dayKey(firstDay)) lastDay = firstDay;
      endsAt = zonedToUtc({ ...lastDay, h: 0, mi: 0, s: 0 }, tz);
    } else {
      startsAt = start.instant!;
      const dtend = get("DTEND");
      const endW = dtend ? parseWhen(dtend.value, dtend.params, tz) : null;
      const dur = get("DURATION");
      endsAt = endW?.instant ?? (dur ? new Date(startsAt.getTime() + parseDuration(dur.value)) : startsAt);
      if (endsAt < startsAt) endsAt = startsAt;
    }

    const rawTitle = unescapeText(get("SUMMARY")?.value ?? "") || "Untitled";
    const named = splitNames(rawTitle, opts.memberNames);
    const attendees = all("ATTENDEE")
      .map((a) => a.params.CN?.trim().toLowerCase())
      .filter(Boolean)
      .map((cn) => opts.memberNames.find((n) => n.toLowerCase() === cn || cn!.startsWith(n.toLowerCase() + " ")))
      .filter((n): n is string => Boolean(n));
    const ev: ImportedEvent = {
      uid,
      title: named.title,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      all_day: allDay,
      rrule: null,
      location: unescapeText(get("LOCATION")?.value ?? "") || null,
      notes: unescapeText(get("DESCRIPTION")?.value ?? "") || null,
      who: [...new Set([...named.who, ...attendees])],
    };

    if (recurrenceId) {
      const w = parseWhen(recurrenceId.value, recurrenceId.params, tz);
      if (w) overrides.push({ uid, day: dayKey(localDay(w, tz)), cancelled, ev: cancelled ? null : ev });
      continue;
    }
    if (cancelled) continue;

    const rruleProp = get("RRULE");
    if (!rruleProp) {
      if (dayKey(localDay({ date: firstDay, instant: endsAt }, tz)) < dayKey(oldest)) skippedOld++;
      else singles.push(ev);
      continue;
    }

    const rule = parseRule(rruleProp.value, tz);
    if (rule === "unsupported") {
      simplified++;
      if (dayKey(firstDay) < dayKey(oldest)) skippedOld++;
      else singles.push(ev);
      continue;
    }
    const exdates = new Set<string>();
    for (const ex of all("EXDATE")) {
      for (const v of ex.value.split(",")) {
        const w = parseWhen(v, ex.params, tz);
        if (w) exdates.add(dayKey(localDay(w, tz)));
      }
    }

    // nth weekday of the month: write out each date up to the horizon
    if (rule.nth) {
      simplified++;
      const length = endsAt.getTime() - startsAt.getTime();
      const sp = allDay ? { h: 0, mi: 0, s: 0 } : zonedParts(startsAt, tz);
      let made = 0;
      for (let i = 0; i < 400; i += rule.interval) {
        const mIndex = firstDay.m - 1 + i;
        const y = firstDay.y + Math.floor(mIndex / 12);
        const m = (mIndex % 12) + 1;
        const day = nthWeekday(y, m, rule.nth.n, rule.nth.day);
        if (!day || dayKey(day) < dayKey(firstDay)) continue;
        if ((rule.until && dayKey(day) > dayKey(rule.until)) || dayKey(day) > dayKey(horizon)) break;
        if (rule.count && made >= rule.count) break;
        made++;
        if (exdates.has(dayKey(day)) || dayKey(day) < dayKey(oldest)) continue;
        const s = zonedToUtc({ ...day, h: sp.h, mi: sp.mi, s: sp.s }, tz);
        singles.push({ ...ev, uid: `${uid}#${dayKey(day)}`, starts_at: s.toISOString(), ends_at: new Date(s.getTime() + length).toISOString() });
      }
      continue;
    }

    const until = rule.count ? lastOfCount(rule, firstDay) : rule.until;
    if (until && dayKey(until) < dayKey(oldest)) {
      skippedOld++;
      continue;
    }
    const bits = [`FREQ=${rule.freq}`];
    if (rule.interval > 1) bits.push(`INTERVAL=${rule.interval}`);
    if (rule.freq === "WEEKLY" && rule.byDay.length) bits.push(`BYDAY=${[...rule.byDay].sort().map((i) => WEEKDAYS[i]).join(",")}`);
    if (until) bits.push(`UNTIL=${dayKey(until)}`);
    masters.set(uid, { ...ev, rrule: bits.join(";"), exdates });
  }

  for (const o of overrides) {
    const master = masters.get(o.uid);
    if (master) master.exdates.add(o.day);
    if (o.ev && dayKey(zonedParts(new Date(o.ev.ends_at), tz)) >= dayKey(oldest)) singles.push({ ...o.ev, uid: `${o.uid}#${o.day}` });
  }

  const repeating = [...masters.values()].map(({ exdates, ...ev }) => {
    const list = [...exdates].sort();
    return list.length ? { ...ev, rrule: `${ev.rrule};EXDATE=${list.join(",")}` } : ev;
  });

  const events = [...repeating, ...singles].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  return { events, skippedOld, simplified };
}
