// "Inspire me": dinner ideas from BBC Good Food. Collection pages list recipes as links
// (and often as a schema.org ItemList), so they work without any API.

export const THEMES = [
  { key: "quick", label: "Quick family dinners", path: "/recipes/collection/quick-and-easy-family-recipes" },
  { key: "midweek", label: "Midweek meals", path: "/recipes/collection/easy-dinner-recipes" },
  { key: "traybake", label: "Traybakes", path: "/recipes/collection/traybake-dinner-recipes" },
  { key: "onepot", label: "One-pots", path: "/recipes/collection/family-one-pot-recipes" },
  { key: "slow", label: "Slow cooker", path: "/recipes/collection/slow-cooker-recipes" },
  { key: "airfryer", label: "Air fryer", path: "/recipes/collection/air-fryer-recipes" },
  { key: "pasta", label: "Pasta", path: "/recipes/collection/pasta-recipes" },
  { key: "veggie", label: "Vegetarian", path: "/recipes/collection/vegetarian-dinner-recipes" },
  { key: "fakeaway", label: "Fakeaways", path: "/recipes/collection/fakeaway-recipes" },
  { key: "batch", label: "Batch cooking", path: "/recipes/collection/batch-cooking-recipes" },
] as const;

export const SITE = "https://www.bbcgoodfood.com";

// Recipe page links found anywhere in a page: hrefs, JSON and ItemList entries
export function recipeLinks(html: string): string[] {
  const found = new Set<string>();
  const re = /(?:https?:\/\/www\.bbcgoodfood\.com|\\?\/)?\/?recipes\/([a-z0-9]+(?:-[a-z0-9]+)+)(?=["'?#\\\s<])/gi;
  for (const m of html.matchAll(re)) {
    const slug = m[1].toLowerCase();
    if (/^(collection|category|search)/.test(slug)) continue;
    found.add(`${SITE}/recipes/${slug}`);
  }
  return [...found];
}

export function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function titleFromSlug(url: string) {
  const slug = url.split("/").pop() ?? "";
  const words = slug.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
