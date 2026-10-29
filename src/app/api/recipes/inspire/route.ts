import { recipeSummary } from "@/lib/recipeLd";
import { fetchText } from "@/lib/safeFetch";
import { getSignedInMember, json } from "@/lib/serverAuth";
import { recipeLinks, shuffle, SITE, THEMES, titleFromSlug } from "@/lib/inspire";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// GET /api/recipes/inspire?theme=quick or ?q=chicken
// Returns up to 9 BBC Good Food recipes with a picture, time and rating.
export async function GET(request: Request) {
  const who = await getSignedInMember();
  if (!who) return json({ error: "Please sign in again." }, 401);

  const params = new URL(request.url).searchParams;
  const q = params.get("q")?.trim().slice(0, 80) ?? "";
  const theme = THEMES.find((t) => t.key === params.get("theme")) ?? THEMES[Math.floor(Math.random() * THEMES.length)];

  const pages = q ? [`${SITE}/search?q=${encodeURIComponent(q)}`] : [`${SITE}${theme.path}`];
  let links: string[] = [];
  for (const page of pages) {
    try {
      links = recipeLinks(await fetchText(page, { accept: "text/html", maxBytes: 3_000_000, timeoutMs: 10000 }));
    } catch {
      links = [];
    }
  }
  // Search results can be filled in by the browser rather than the page itself;
  // if none came back, try the matching collection page instead
  if (q && links.length === 0) {
    const guess = `${SITE}/recipes/collection/${q.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-recipes`;
    try {
      links = recipeLinks(await fetchText(guess, { accept: "text/html", maxBytes: 3_000_000, timeoutMs: 10000 }));
    } catch {}
  }
  if (links.length === 0) {
    return json({ ideas: [], message: q ? `No BBC Good Food recipes came up for "${q}". Try a simpler word, like "chicken" or "pasta".` : "BBC Good Food didn't answer. Try again in a moment." });
  }

  const picks = shuffle(links).slice(0, 12);
  const ideas = (
    await Promise.all(
      picks.map(async (url) => {
        try {
          const s = recipeSummary(await fetchText(url, { accept: "text/html", maxBytes: 2_500_000, timeoutMs: 8000 }));
          return s ? { url, ...s } : null;
        } catch {
          return { url, title: titleFromSlug(url), image_url: null, minutes: null, rating: null };
        }
      }),
    )
  )
    .filter(Boolean)
    .slice(0, 9);

  return json({ ideas, theme: q ? null : theme.key });
}
