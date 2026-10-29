import { askClaude, ClaudeNotSetUp, ClaudeProblem, parseJson } from "@/lib/claude";
import { recipeLinks, SITE } from "@/lib/inspire";
import { recipeSummary } from "@/lib/recipeLd";
import { fetchText } from "@/lib/safeFetch";
import { getSignedInMember, json } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Idea = { name: string; why: string; uses: string[]; extra: string[]; search: string };

const SYSTEM = `You suggest family dinners for a UK household (two adults, a young girl and a baby) based on what they have in the fridge and cupboards.
Reply with JSON only, no other text, in exactly this shape:
{"ideas":[{"name":"dish name","why":"one short friendly sentence","uses":["ingredients from their list it uses"],"extra":["things they'd probably need to buy, keep short"],"search":"2-3 word search for BBC Good Food, e.g. chicken fajitas"}]}
Give 5 ideas, mostly using what they have, realistic for a weeknight, child-friendly where possible. Use British names for ingredients (courgette, coriander, mince).`;

// POST { ingredients: "chicken, peppers, rice, cheese" }
export async function POST(request: Request) {
  const who = await getSignedInMember();
  if (!who) return json({ error: "Please sign in again." }, 401);
  const { ingredients } = (await request.json().catch(() => ({}))) as { ingredients?: string };
  const text = ingredients?.trim().slice(0, 1500);
  if (!text) return json({ error: "Type a few things you've got in, like chicken, peppers and rice." }, 400);

  let ideas: Idea[];
  try {
    const reply = await askClaude({ system: SYSTEM, content: [{ type: "text", text: `What we've got: ${text}` }], maxTokens: 1500 });
    ideas = (parseJson<{ ideas: Idea[] }>(reply)?.ideas ?? []).filter((i) => i?.name).slice(0, 6);
  } catch (e) {
    if (e instanceof ClaudeNotSetUp) return json({ error: e.message, notSetUp: true }, 503);
    return json({ error: e instanceof ClaudeProblem ? e.message : "Couldn't get ideas just now." }, 502);
  }
  if (!ideas.length) return json({ error: "Claude didn't come up with anything. Try adding a few more ingredients." }, 502);

  // Find a real BBC Good Food recipe for each idea, so it can be planned and shopped for
  const withRecipes = await Promise.all(
    ideas.map(async (idea) => {
      try {
        const links = recipeLinks(await fetchText(`${SITE}/search?q=${encodeURIComponent(idea.search || idea.name)}`, { accept: "text/html", timeoutMs: 9000 }));
        for (const url of links.slice(0, 2)) {
          const s = recipeSummary(await fetchText(url, { accept: "text/html", maxBytes: 2_500_000, timeoutMs: 8000 }));
          if (s) return { ...idea, recipe: { url, ...s } };
        }
      } catch {}
      return { ...idea, recipe: null };
    }),
  );
  return json({ ideas: withRecipes });
}
