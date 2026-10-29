import { BAD_KEY, bearer, say } from "@/lib/siri";
import { getAnonSupabase } from "@/lib/supabase/anon";

export const dynamic = "force-dynamic";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// "Hey Siri, what's for dinner": GET with Authorization: Bearer <personal key>. Add ?day=tomorrow for tomorrow.
// From 8pm it answers about tomorrow, and if a day has nothing planned it says what the next planned dinner is.
export async function GET(request: Request) {
  const token = bearer(request);
  if (!token) return say(BAD_KEY, 401);

  const ukHour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "numeric", hour12: false }).format(new Date()));
  const askedTomorrow = new URL(request.url).searchParams.get("day") === "tomorrow";
  const lateEvening = !askedTomorrow && ukHour >= 20;
  const first = askedTomorrow || lateEvening ? 1 : 0;

  const sb = getAnonSupabase();
  const look = async (offset: number) => {
    const { data, error } = await sb.rpc("dinner_tonight", { api_token: token, day_offset: offset });
    if (error) throw error;
    return data as { date: string; title: string | null } | null;
  };

  try {
    const day = await look(first);
    if (!day) return say(BAD_KEY, 401);
    const label = first === 0 ? "tonight" : "tomorrow";
    const lead = lateEvening ? "Tonight's done. " : "";
    if (day.title?.trim()) return say(`${lead}${label === "tonight" ? "Tonight" : "Tomorrow"} it's ${day.title.trim()}.`);

    // Nothing planned: find the next dinner that is
    for (let offset = first + 1; offset <= 6; offset++) {
      const next = await look(offset);
      if (next?.title?.trim()) {
        const when = offset === 1 ? "tomorrow" : `on ${DAYS[new Date(`${next.date}T12:00:00Z`).getUTCDay()]}`;
        return say(`${lead}Nothing's planned for ${label} yet. The next dinner is ${next.title.trim()}, ${when}.`);
      }
    }
    return say(`${lead}Nothing's planned for ${label}, or the rest of the week. Open the planner to add some dinners.`);
  } catch {
    return say("Sorry, the planner isn't answering. Try again in a moment.", 503);
  }
}
