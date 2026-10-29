import { buildCalendar, type Feed } from "@/lib/ics";
import { getAnonSupabase } from "@/lib/supabase/anon";

export const dynamic = "force-dynamic";

// The iPhone Calendar app subscribes to this link. The token in the link is the only key.
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const clean = token.replace(/\.ics$/i, "");
  if (!/^[0-9a-f]{32,128}$/i.test(clean)) return new Response("Not found", { status: 404 });

  const { data, error } = await getAnonSupabase().rpc("calendar_feed", { feed_token: clean });
  if (error) return new Response("The calendar couldn't be loaded. Try again later.", { status: 503 });
  if (!data) return new Response("Not found", { status: 404 });

  const host = new URL(request.url).host;
  return new Response(buildCalendar(data as Feed, host), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="planner.ics"',
      "Cache-Control": "private, max-age=300",
    },
  });
}
