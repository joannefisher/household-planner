import { askClaude, ClaudeNotSetUp, ClaudeProblem, parseJson } from "@/lib/claude";
import { getSignedInMember, json } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export type SchoolCalendar = {
  school: string | null;
  terms: { name: string; start: string; end: string }[];
  holidays: { title: string; start: string; end: string }[];
  noSchool: { title: string; start: string; end: string }[];
  events: { title: string; date: string; endDate: string | null; start: string | null; end: string | null }[];
};

const SYSTEM = `You read UK school calendars (term dates letters, PDFs, photos of printed calendars) and turn them into structured data.
Reply with JSON only, no other text, in exactly this shape:
{"school":"school name or null",
 "terms":[{"name":"Autumn 1","start":"YYYY-MM-DD","end":"YYYY-MM-DD"}],
 "holidays":[{"title":"October half term","start":"YYYY-MM-DD","end":"YYYY-MM-DD"}],
 "noSchool":[{"title":"INSET day","start":"YYYY-MM-DD","end":"YYYY-MM-DD"}],
 "events":[{"title":"Christmas concert","date":"YYYY-MM-DD","endDate":null,"start":"HH:MM or null","end":"HH:MM or null"}]}
Rules:
- "terms" are the periods pupils attend, split at half terms, from the first to the last day pupils are in.
- "holidays" are half terms and main holidays between terms.
- "noSchool" are single days or short closures inside a term when pupils are off: INSET/training days, bank holidays, polling days.
- "events" are everything else worth a family calendar: trips, concerts, sports days, parents' evenings, photo days, non-uniform days, early finishes (put the finish time in "end").
- Use full dates. If the year isn't printed, work it out from the school year shown and today's date. Leave out anything you can't date.`;

// POST { kind: "pdf" | "image" | "text", mediaType?, data } (data is base64 for pdf and image, plain text otherwise)
export async function POST(request: Request) {
  const who = await getSignedInMember();
  if (!who) return json({ error: "Please sign in again." }, 401);
  const body = (await request.json().catch(() => null)) as { kind?: string; mediaType?: string; data?: string } | null;
  if (!body?.data || !body.kind) return json({ error: "Choose a file first." }, 400);

  const today = new Date().toISOString().slice(0, 10);
  const lead = { type: "text" as const, text: `Today is ${today}. Here is our school calendar.` };
  const content =
    body.kind === "pdf"
      ? [lead, { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: body.data } }]
      : body.kind === "image"
        ? [lead, { type: "image" as const, source: { type: "base64" as const, media_type: body.mediaType || "image/jpeg", data: body.data } }]
        : [{ type: "text" as const, text: `${lead.text}\n\n${body.data.slice(0, 60000)}` }];

  try {
    const reply = await askClaude({ system: SYSTEM, content, maxTokens: 6000 });
    const cal = parseJson<SchoolCalendar>(reply);
    if (!cal) return json({ error: "Claude couldn't make sense of that file. Try a clearer copy, or a PDF." }, 422);
    const ok = (d: unknown) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
    return json({
      calendar: {
        school: cal.school ?? null,
        terms: (cal.terms ?? []).filter((t) => ok(t.start) && ok(t.end)),
        holidays: (cal.holidays ?? []).filter((t) => ok(t.start) && ok(t.end)),
        noSchool: (cal.noSchool ?? []).filter((t) => ok(t.start) && ok(t.end)),
        events: (cal.events ?? []).filter((e) => e.title && ok(e.date)),
      },
    });
  } catch (e) {
    if (e instanceof ClaudeNotSetUp) return json({ error: e.message, notSetUp: true }, 503);
    return json({ error: e instanceof ClaudeProblem ? e.message : "Couldn't read that just now." }, 502);
  }
}
