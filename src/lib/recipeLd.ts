// Finds the schema.org Recipe that most recipe sites embed as JSON-LD, and turns it into
// { title, image, servings, ingredients[], method[] }. Section names in the method start with "# ".

export type ExtractedRecipe = {
  title: string;
  image_url: string | null;
  servings: number | null;
  ingredients: string[];
  method: string[];
};

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type Obj = { [k: string]: Json };

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", frac12: "½", frac14: "¼", frac34: "¾", deg: "°", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", hellip: "…", eacute: "é", egrave: "è", times: "×" };

export function decodeEntities(s: string) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

export function cleanText(s: string) {
  return decodeEntities(decodeEntities(s.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ")))
    .replace(/[ \t ]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

function isRecipe(o: Obj) {
  const t = o["@type"];
  return t === "Recipe" || (Array.isArray(t) && t.includes("Recipe")) || (typeof t === "string" && /(^|\/)Recipe$/.test(t));
}

function findRecipe(node: Json, depth = 0): Obj | null {
  if (!node || typeof node !== "object" || depth > 8) return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const r = findRecipe(n, depth + 1);
      if (r) return r;
    }
    return null;
  }
  if (isRecipe(node)) return node;
  for (const key of ["@graph", "mainEntity", "mainEntityOfPage", "itemListElement", "item", "about"]) {
    const r = findRecipe(node[key], depth + 1);
    if (r) return r;
  }
  return null;
}

function text(v: Json | undefined): string {
  if (v == null) return "";
  if (typeof v === "string") return cleanText(v);
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return v.map(text).filter(Boolean).join(" ");
  if (typeof v === "object") return text(v.text ?? v.name ?? "");
  return "";
}

function image(v: Json | undefined): string | null {
  if (!v) return null;
  if (typeof v === "string") return /^https?:\/\//.test(v) ? v : null;
  if (Array.isArray(v)) {
    for (const x of v) {
      const r = image(x);
      if (r) return r;
    }
    return null;
  }
  if (typeof v === "object") return image(v.url ?? v.contentUrl ?? null);
  return null;
}

export function servingsFrom(v: Json | undefined): number | null {
  if (v == null) return null;
  if (typeof v === "number") return v > 0 && v < 100 ? Math.round(v) : null;
  if (Array.isArray(v)) {
    for (const x of v) {
      const r = servingsFrom(x);
      if (r) return r;
    }
    return null;
  }
  const m = text(v).match(/(\d+)(?:\s*(?:-|to|–)\s*(\d+))?/);
  if (!m) return null;
  const n = Number(m[1]);
  return n > 0 && n < 100 ? n : null;
}

function steps(v: Json | undefined, out: string[] = []): string[] {
  if (v == null) return out;
  if (typeof v === "string") {
    for (const line of cleanText(v).split(/\n+/)) if (line.trim()) out.push(line.trim());
    return out;
  }
  if (Array.isArray(v)) {
    for (const x of v) steps(x, out);
    return out;
  }
  if (typeof v === "object") {
    const t = v["@type"];
    const isSection = t === "HowToSection" || (Array.isArray(t) && t.includes("HowToSection")) || (v.itemListElement && !v.text);
    if (isSection) {
      const name = text(v.name);
      if (name) out.push(`# ${name}`);
      steps(v.itemListElement ?? v.steps ?? null, out);
    } else {
      const s = text(v.text ?? v.description ?? v.name);
      if (s) out.push(s);
    }
  }
  return out;
}

export function parseJsonLdBlocks(html: string): Json[] {
  const out: Json[] = [];
  const re = /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) {
    const raw = m[1].trim().replace(/^<!--/, "").replace(/-->$/, "").replace(/^\/\*<!\[CDATA\[\*\//, "").replace(/\/\*\]\]>\*\/$/, "").trim();
    try {
      out.push(JSON.parse(raw));
    } catch {
      // Some sites put raw line breaks inside strings
      try {
        out.push(JSON.parse(raw.replace(/[\r\n\t]+/g, " ")));
      } catch {
        /* not valid JSON: skip */
      }
    }
  }
  return out;
}

export function extractRecipe(html: string): ExtractedRecipe | null {
  for (const block of parseJsonLdBlocks(html)) {
    const r = findRecipe(block);
    if (!r) continue;
    const title = text(r.name ?? r.headline);
    const rawIngredients = r.recipeIngredient ?? r.ingredients ?? [];
    const ingredients = (Array.isArray(rawIngredients) ? rawIngredients : [rawIngredients]).map(text).map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);
    if (!title || ingredients.length === 0) continue;
    return {
      title: title.slice(0, 200),
      image_url: image(r.image ?? r.thumbnailUrl),
      servings: servingsFrom(r.recipeYield ?? r.yield),
      ingredients: ingredients.slice(0, 80),
      method: steps(r.recipeInstructions).slice(0, 80),
    };
  }
  return null;
}

// For the "no recipe found" message
export function pageTitle(html: string) {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  const t = og?.[1] ?? html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
  return t ? cleanText(t).slice(0, 120) : null;
}
