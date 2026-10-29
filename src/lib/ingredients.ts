// Turns recipe lines like "2 x 400g tins chopped tomatoes" or "1½ tbsp olive oil, plus extra"
// into shopping items, scales them for the number of people, leaves out staples,
// and merges them with what's already on the list.

import { guessAisle, type Aisle } from "./parse";

export type Ingredient = { name: string; quantity: number | null; unit: string | null };

const FRACTIONS: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875, "⅕": 0.2, "⅙": 1 / 6 };
const WORD_NUMBERS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, half: 0.5, "a half": 0.5, dozen: 12 };

// Canonical unit names; anything spoon-sized is left off the shopping quantity
const UNIT_ALIASES: [RegExp, string][] = [
  [/^(kg|kgs|kilo|kilos|kilograms?)$/, "kg"],
  [/^(g|gr|grams?|grammes?)$/, "g"],
  [/^(mg)$/, "mg"],
  [/^(ml|millilitres?|milliliters?|mls)$/, "ml"],
  [/^(l|litres?|liters?|ltr)$/, "l"],
  [/^(cl)$/, "cl"],
  [/^(oz|ounces?)$/, "oz"],
  [/^(lb|lbs|pounds?)$/, "lb"],
  [/^(tsps?|teaspoons?|tsp\.)$/, "tsp"],
  [/^(tbsps?|tablespoons?|tbs|tbls?|tbsp\.)$/, "tbsp"],
  [/^(cups?)$/, "cup"],
  [/^(pinch(es)?)$/, "pinch"],
  [/^(dash(es)?|splash(es)?|drizzle|glug)$/, "dash"],
  [/^(handfuls?)$/, "handful"],
  [/^(sprigs?)$/, "sprig"],
  [/^(knobs?)$/, "knob"],
  [/^(cloves?)$/, "cloves"],
  [/^(tins?|cans?)$/, "tins"],
  [/^(jars?)$/, "jars"],
  [/^(packs?|packets?|pkts?)$/, "packs"],
  [/^(bags?)$/, "bags"],
  [/^(bunch(es)?)$/, "bunch"],
  [/^(cartons?)$/, "cartons"],
  [/^(bottles?)$/, "bottles"],
  [/^(tubs?|pots?)$/, "tubs"],
  [/^(slices?)$/, "slices"],
  [/^(rashers?)$/, "rashers"],
  [/^(sticks?)$/, "sticks"],
  [/^(sachets?)$/, "sachets"],
  [/^(sheets?)$/, "sheets"],
  [/^(fillets?)$/, "fillets"],
  [/^(heads?)$/, "heads"],
  [/^(balls?)$/, "balls"],
  [/^(stalks?)$/, "stalks"],
];
const SPOONY = new Set(["tsp", "tbsp", "pinch", "dash", "handful", "sprig", "knob", "cup", "mg", "cl"]);
const CONTAINERS = new Set(["tins", "jars", "packs", "bags", "cartons", "bottles", "tubs", "sachets"]);

function unitOf(word: string): string | null {
  const w = word.toLowerCase().replace(/\.$/, "");
  for (const [re, u] of UNIT_ALIASES) if (re.test(w)) return u;
  return null;
}

const NUM = String.raw`(?:\d+(?:[.,]\d+)?(?:\s+\d+\/\d+|\s*[½¼¾⅓⅔⅛⅜⅝⅞⅕⅙])?|\d+\/\d+|[½¼¾⅓⅔⅛⅜⅝⅞⅕⅙])`;

export function toNumber(s: string): number | null {
  const t = s.trim();
  if (FRACTIONS[t] !== undefined) return FRACTIONS[t];
  const mixedUnicode = t.match(/^(\d+)\s*([½¼¾⅓⅔⅛⅜⅝⅞⅕⅙])$/);
  if (mixedUnicode) return Number(mixedUnicode[1]) + FRACTIONS[mixedUnicode[2]];
  const mixed = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = t.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[2]) ? Number(frac[1]) / Number(frac[2]) : null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

const PREP = /\b(finely|roughly|thinly|coarsely|freshly|lightly|very|well)\s+(chopped|sliced|diced|grated|minced|crushed|ground|shredded|beaten|torn|peeled)\b|\b(chopped|sliced|diced|grated|minced|crushed|shredded|beaten|torn|peeled|deseeded|trimmed|halved|quartered|softened|melted|cubed|rinsed|drained|sifted|zested|juiced|large|medium|small|big|heaped|level|rounded|generous|about|approx\.?|approximately|free[- ]range|good[- ]quality|ripe)\b/gi;

export function cleanName(raw: string) {
  let n = raw
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .split(/,|;|\s[-–]\s|\bfor (?:the )?(?:serving|garnish|frying|greasing|dusting)\b|\bto serve\b|\bto taste\b|\bplus (?:extra|more)\b|\boptional\b|\bor\s+(?:to taste|more|extra)\b/i)[0];
  n = n.replace(PREP, " ").replace(/^\s*(of|x)\s+/i, " ").replace(/\s+/g, " ").trim();
  n = n.replace(/^(of|x|an?)\s+/i, "").replace(/[.:*]+$/, "").trim();
  return n ? n.charAt(0).toUpperCase() + n.slice(1) : "";
}

export function parseIngredient(line: string): Ingredient | null {
  let s = line.replace(/\s+/g, " ").replace(/(\d)\s*[–—]\s*(\d)/g, "$1-$2").trim();
  s = s.replace(/^[-•*▢□☐]\s*/, "");
  if (!s) return null;
  // Metric/imperial pairs: "200g/7oz" → "200g"
  s = s.replace(/(\d)\s*(g|kg|ml|l|oz|lb)\s*\/\s*[\d.½¼¾]+\s*(?:oz|lb|fl ?oz|g|ml|cups?)\b/i, "$1$2");
  // "two onions" → "2 onions"; "a pinch of salt" → "1 pinch of salt"; "a lemon" stays as it is
  const word = s.match(new RegExp(`^(${Object.keys(WORD_NUMBERS).sort((a, b) => b.length - a.length).join("|")})\\s+(.*)$`, "i"));
  if (word) {
    const w = word[1].toLowerCase();
    if (w !== "a" && w !== "an") s = `${WORD_NUMBERS[w]} ${word[2]}`;
    else if (unitOf(word[2].split(/\s+/)[0] ?? "")) s = `1 ${word[2]}`;
  }

  const head = s.match(new RegExp(`^(${NUM})(?:\\s*(?:-|to)\\s*(${NUM}))?\\s*(?:x\\s*)?(.*)$`, "i"));
  if (!head) return { name: cleanName(s), quantity: null, unit: null };
  let quantity = toNumber(head[2] ?? head[1]);
  let rest = head[3].trim();
  let unit: string | null = null;

  // "400g tin of tomatoes" or "2 x 400g tins" → count the tins
  const sizeThenContainer = rest.match(new RegExp(`^(${NUM})\\s*(g|kg|ml|l|oz|lb)\\b\\s*(\\w+)\\s+(.*)$`, "i"));
  const firstWord = rest.match(/^([a-z.]+)\b\s*(.*)$/i);
  if (sizeThenContainer && CONTAINERS.has(unitOf(sizeThenContainer[3]) ?? "")) {
    unit = unitOf(sizeThenContainer[3]);
    rest = sizeThenContainer[4];
  } else if (firstWord && unitOf(firstWord[1])) {
    unit = unitOf(firstWord[1]);
    rest = firstWord[2];
    // "1 x 400g tin" written as "400g tin chopped tomatoes"
    const container = rest.match(/^([a-z]+)\s+(.*)$/i);
    if ((unit === "g" || unit === "ml" || unit === "kg") && container && CONTAINERS.has(unitOf(container[1]) ?? "")) {
      unit = unitOf(container[1]);
      quantity = 1;
      rest = container[2];
    }
  } else {
    const glued = rest.match(/^(g|kg|ml|l)\b\s*(.*)$/i);
    if (glued) {
      unit = glued[1].toLowerCase();
      rest = glued[2];
    }
  }
  const name = cleanName(rest);
  if (!name) return null;
  return { name, quantity, unit };
}

// Merge key: lower case, no punctuation, last word singular
export function nameKey(name: string) {
  const words = name.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  const last = words[words.length - 1];
  words[words.length - 1] = last.endsWith("oes") ? last.slice(0, -2) : last.endsWith("ies") ? `${last.slice(0, -3)}y` : last.endsWith("ches") || last.endsWith("shes") ? last.slice(0, -2) : last.endsWith("s") && !last.endsWith("ss") ? last.slice(0, -1) : last;
  return words.join(" ");
}

export function isStaple(name: string, staples: string[]) {
  const key = ` ${nameKey(name)} `;
  return staples.some((s) => {
    const k = nameKey(s);
    return k && key.includes(` ${k} `);
  });
}

const roundQty = (q: number, unit: string | null) => {
  if (unit === "g" || unit === "ml") return q >= 100 ? Math.round(q / 5) * 5 : Math.round(q);
  if (unit === "kg" || unit === "l") return Math.round(q * 100) / 100;
  return q < 1 ? Math.round(q * 4) / 4 || 0.25 : Math.ceil(q - 0.05);
};

// What to buy for a recipe: scaled, spoonfuls dropped to just the name
export function shoppingLines(lines: string[], scale: number): (Ingredient & { aisle: Aisle })[] {
  const out: (Ingredient & { aisle: Aisle })[] = [];
  for (const line of lines) {
    const p = parseIngredient(line);
    if (!p || p.name.length < 2) continue;
    let { quantity, unit } = p;
    if (unit && SPOONY.has(unit)) {
      quantity = null;
      unit = null;
    }
    if (quantity != null) quantity = roundQty(quantity * scale, unit);
    out.push({ name: p.name, quantity, unit, aisle: guessAisle(p.name) });
  }
  return out;
}

export type ListItem = { id: string; name: string; quantity: number | null; unit: string | null; checked: boolean };
export type Plan =
  | { kind: "insert"; name: string; quantity: number | null; unit: string | null; aisle: Aisle; mealPlanId: string | null }
  | { kind: "update"; id: string; quantity: number | null; unit: string | null; reopen: boolean; mealPlanId: string | null };

// Works out list changes: new rows, quantity top-ups for unticked items, or re-adding ticked ones.
export function planShopping(
  wanted: { name: string; quantity: number | null; unit: string | null; aisle: Aisle; mealPlanId: string | null }[],
  list: ListItem[],
  staples: string[],
) {
  const plans: Plan[] = [];
  const skipped: string[] = [];
  const byKey = new Map<string, ListItem>();
  for (const i of list) {
    const k = nameKey(i.name);
    const prev = byKey.get(k);
    if (!prev || (prev.checked && !i.checked)) byKey.set(k, i);
  }
  const pending = new Map<string, Extract<Plan, { kind: "insert" }>>();
  for (const w of wanted) {
    if (isStaple(w.name, staples)) {
      skipped.push(w.name);
      continue;
    }
    const k = nameKey(w.name);
    const p = pending.get(k);
    if (p) {
      if (p.unit === w.unit && p.quantity != null && w.quantity != null) p.quantity = roundQty(p.quantity + w.quantity, p.unit);
      else if (p.quantity == null && p.unit == null) {
        p.quantity = w.quantity;
        p.unit = w.unit;
      }
      continue;
    }
    const existing = byKey.get(k);
    if (existing) {
      const prior = plans.find((x) => x.kind === "update" && x.id === existing.id) as Extract<Plan, { kind: "update" }> | undefined;
      const base = prior ?? { kind: "update" as const, id: existing.id, quantity: existing.checked ? null : existing.quantity, unit: existing.checked ? null : existing.unit, reopen: existing.checked, mealPlanId: w.mealPlanId };
      if (base.quantity == null && base.unit == null) {
        base.quantity = w.quantity;
        base.unit = w.unit;
      } else if (base.unit === w.unit && base.quantity != null && w.quantity != null) {
        base.quantity = roundQty(base.quantity + w.quantity, base.unit);
      }
      if (!prior) plans.push(base);
      continue;
    }
    const ins = { kind: "insert" as const, ...w };
    pending.set(k, ins);
    plans.push(ins);
  }
  return { plans, skipped };
}
