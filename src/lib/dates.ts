const TZ = "Europe/London";

// YYYY-MM-DD for a date in UK time
export function isoDay(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function nextSevenDays(from = new Date()) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(from.getTime() + i * 864e5);
    return { iso: isoDay(d), date: d };
  });
}

export function fmt(d: Date, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, ...opts }).format(d);
}

export function timeOf(iso: string) {
  return fmt(new Date(iso), { hour: "2-digit", minute: "2-digit", hour12: false });
}
