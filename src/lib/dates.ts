// The household's devices are all in the UK, so dates use the device's local time.

const pad = (n: number) => String(n).padStart(2, "0");

export function isoDay(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromIsoDay(iso: string, hours = 0, minutes = 0) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, hours, minutes);
}

export function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function startOfWeek(d: Date) {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (r.getDay() + 6) % 7; // Monday = 0
  return addDays(r, -dow);
}

export function weekDays(weekStart: Date) {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    return { iso: isoDay(date), date };
  });
}

export function fmt(d: Date, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-GB", opts).format(d);
}

export function hhmm(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function minutesOfDay(d: Date) {
  return d.getHours() * 60 + d.getMinutes();
}

export function weekLabel(weekStart: Date) {
  const end = addDays(weekStart, 6);
  const sameMonth = weekStart.getMonth() === end.getMonth();
  const a = fmt(weekStart, sameMonth ? { day: "numeric" } : { day: "numeric", month: "short" });
  const b = fmt(end, { day: "numeric", month: "short" });
  return `${a} – ${b}`;
}
