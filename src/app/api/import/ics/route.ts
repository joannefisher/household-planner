import { parseIcs, type ImportedEvent } from "@/lib/icsParse";
import { fetchText, FetchProblem } from "@/lib/safeFetch";
import { getSignedInMember, json } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// One-time import from Cozi (or any iCal link or .ics file) into the signed-in person's household.
// POST { url?: string, text?: string, commit?: boolean }. Without commit it only counts.
export async function POST(request: Request) {
  const who = await getSignedInMember();
  if (!who) return json({ error: "Please sign in again." }, 401);
  const { sb, member, household } = who;

  const body = (await request.json().catch(() => ({}))) as { url?: string; text?: string; commit?: boolean };
  let text = body.text ?? "";
  if (!text && body.url) {
    try {
      text = await fetchText(body.url, { accept: "text/calendar, */*" });
    } catch (e) {
      return json({ error: e instanceof FetchProblem ? e.message : "That link didn't open." }, 400);
    }
  }
  if (!/BEGIN:VCALENDAR/i.test(text)) return json({ error: "That isn't a calendar link. In Cozi, copy the link from Settings → Shared Cozi calendars." }, 400);

  const { data: members } = await sb.from("members").select("id,name").eq("household_id", household.id);
  const memberList = (members ?? []) as { id: string; name: string }[];
  const parsed = parseIcs(text, { timezone: household.timezone, memberNames: memberList.map((m) => m.name) });

  // Skip anything already in the planner with the same title and start
  const { data: existing } = await sb.from("events").select("title,starts_at").eq("household_id", household.id);
  const key = (title: string, start: string) => `${title.trim().toLowerCase()}|${new Date(start).getTime()}`;
  const seen = new Set((existing ?? []).map((e) => key(e.title, e.starts_at)));
  const fresh: ImportedEvent[] = [];
  for (const ev of parsed.events) {
    const k = key(ev.title, ev.starts_at);
    if (seen.has(k)) continue;
    seen.add(k);
    fresh.push(ev);
  }

  const summary = {
    total: parsed.events.length,
    toImport: fresh.length,
    duplicates: parsed.events.length - fresh.length,
    repeating: fresh.filter((e) => e.rrule).length,
    skippedOld: parsed.skippedOld,
    simplified: parsed.simplified,
    sample: fresh.slice(0, 6).map((e) => ({ title: e.title, starts_at: e.starts_at, all_day: e.all_day, repeats: Boolean(e.rrule), who: e.who })),
  };
  if (!body.commit) return json(summary);

  const idOf = new Map(memberList.map((m) => [m.name, m.id]));
  for (let i = 0; i < fresh.length; i += 200) {
    const chunk = fresh.slice(i, i + 200).map((e) => ({ ...e, id: crypto.randomUUID() }));
    const { error } = await sb.from("events").insert(
      chunk.map((e) => ({
        id: e.id,
        household_id: household.id,
        title: e.title.slice(0, 300),
        starts_at: e.starts_at,
        ends_at: e.ends_at,
        all_day: e.all_day,
        rrule: e.rrule,
        location: e.location?.slice(0, 500) ?? null,
        notes: e.notes?.slice(0, 4000) ?? null,
        created_by: member.id,
      })),
    );
    if (error) return json({ error: "Some events didn't save. Try the import again; ones already saved will be skipped.", imported: i }, 500);
    const links = chunk.flatMap((e) => e.who.map((n) => idOf.get(n)).filter(Boolean).map((member_id) => ({ event_id: e.id, member_id: member_id! })));
    if (links.length) await sb.from("event_members").insert(links);
  }
  return json({ ...summary, imported: fresh.length });
}
