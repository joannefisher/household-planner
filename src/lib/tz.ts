// Time zone helpers that work the same on a UK phone and on a server running in UTC.

export type Parts = { y: number; m: number; d: number; h: number; mi: number; s: number };

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string) {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(tz, f);
  }
  return f;
}

// The wall-clock time in a zone at an instant
export function zonedParts(date: Date, tz: string): Parts {
  const p = Object.fromEntries(formatter(tz).formatToParts(date).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, mi: +p.minute, s: +p.second };
}

// The instant when a zone's clock shows the given wall-clock time
export function zonedToUtc(p: Parts, tz: string): Date {
  const wall = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s);
  let guess = wall;
  for (let i = 0; i < 3; i++) {
    const seen = zonedParts(new Date(guess), tz);
    const diff = wall - Date.UTC(seen.y, seen.m - 1, seen.d, seen.h, seen.mi, seen.s);
    if (diff === 0) break;
    guess += diff;
  }
  return new Date(guess);
}

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

export const compactDate = (p: Pick<Parts, "y" | "m" | "d">) => `${pad(p.y, 4)}${pad(p.m)}${pad(p.d)}`;
export const compactDateTime = (p: Parts) => `${compactDate(p)}T${pad(p.h)}${pad(p.mi)}${pad(p.s)}`;

// Whole-day arithmetic on calendar dates, free of time zones
export function addDaysToParts(p: Pick<Parts, "y" | "m" | "d">, n: number) {
  const t = new Date(Date.UTC(p.y, p.m - 1, p.d + n));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}
