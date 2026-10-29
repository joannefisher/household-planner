import { extractRecipe, pageTitle } from "@/lib/recipeLd";
import { cleanUrl, fetchText, FetchProblem } from "@/lib/safeFetch";
import { getSignedInMember, json } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Saves a recipe from a pasted link, using the schema.org Recipe data most recipe sites include.
export async function POST(request: Request) {
  const who = await getSignedInMember();
  if (!who) return json({ error: "Please sign in again." }, 401);
  const { sb, household } = who;

  const { url } = (await request.json().catch(() => ({}))) as { url?: string };
  if (!url?.trim()) return json({ error: "Paste a link to a recipe." }, 400);

  let link: string;
  try {
    link = cleanUrl(url).toString();
  } catch (e) {
    return json({ error: e instanceof FetchProblem ? e.message : "That doesn't look like a link." }, 400);
  }

  // Already saved? Use that one.
  const { data: existing } = await sb.from("recipes").select("*").eq("household_id", household.id).eq("source_url", link).maybeSingle();
  if (existing) return json({ recipe: existing, existing: true });

  let html: string;
  try {
    html = await fetchText(link, { maxBytes: 4_000_000, accept: "text/html,application/xhtml+xml" });
  } catch (e) {
    return json({ error: e instanceof FetchProblem ? e.message : "That link didn't open." }, 400);
  }

  const found = extractRecipe(html);
  if (!found) {
    const title = pageTitle(html);
    return json(
      {
        error: "That page doesn't share its recipe in a way the planner can read. You can type it in instead.",
        title,
        noRecipe: true,
      },
      422,
    );
  }

  const { data, error } = await sb
    .from("recipes")
    .insert({
      household_id: household.id,
      title: found.title,
      source_url: link,
      image_url: found.image_url,
      servings: found.servings,
      ingredients: found.ingredients,
      method: found.method,
    })
    .select("*")
    .single();
  if (error) return json({ error: "The recipe didn't save. Try again." }, 500);
  return json({ recipe: data });
}
