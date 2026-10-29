import { parseItems } from "@/lib/parse";
import { itemsFromSpeech } from "@/lib/spokenItems";
import { addReply, BAD_KEY, bearer, readText, say } from "@/lib/siri";
import { getAnonSupabase } from "@/lib/supabase/anon";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

// "Hey Siri, add to shopping": POST the dictated text with Authorization: Bearer <personal key>
export async function POST(request: Request) {
  const token = bearer(request);
  if (!token) return say(BAD_KEY, 401);

  const text = (await readText(request)).slice(0, 1000).trim();
  const items = parseItems(await itemsFromSpeech(text)).slice(0, 30);
  if (!items.length) return say("I didn't catch anything to add.");

  const { data, error } = await getAnonSupabase().rpc("add_shopping_items", { api_token: token, items });
  if (error) return say("Sorry, the shopping list isn't answering. Try again in a moment.", 503);
  if (!data) return say(BAD_KEY, 401);
  const { added = [], already = [] } = data as { added?: string[]; already?: string[] };
  return say(addReply(added, already));
}
