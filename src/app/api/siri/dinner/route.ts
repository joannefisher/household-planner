import { BAD_KEY, bearer, say, spokenList } from "@/lib/siri";
import { getAnonSupabase } from "@/lib/supabase/anon";

export const dynamic = "force-dynamic";

// "Hey Siri, what's for dinner": GET with Authorization: Bearer <personal key>. Add ?day=tomorrow for tomorrow.
export async function GET(request: Request) {
  const token = bearer(request);
  if (!token) return say(BAD_KEY, 401);
  const tomorrow = new URL(request.url).searchParams.get("day") === "tomorrow";

  const { data, error } = await getAnonSupabase().rpc("dinner_tonight", { api_token: token, day_offset: tomorrow ? 1 : 0 });
  if (error) return say("Sorry, the planner isn't answering. Try again in a moment.", 503);
  if (!data) return say(BAD_KEY, 401);

  const title = (data as { title: string | null }).title?.trim();
  const when = tomorrow ? "tomorrow" : "tonight";
  if (!title) return say(`Nothing's planned for dinner ${when}.`);
  return say(`${tomorrow ? "Tomorrow" : "Tonight"} it's ${spokenList([title])}.`);
}
