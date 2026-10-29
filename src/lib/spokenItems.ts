// Siri dictation usually arrives with no commas: "eggs bread semi skimmed milk bin bags".
// Claude splits it into items when it can; otherwise a word list does a decent job.

import { askClaude, parseJson } from "./claude";

const HAS_SEPARATORS = /,|;|\n|\band\b|&|\bplus\b/i;

// Words that belong with the word after them ("chopped tomatoes", "semi skimmed milk")
const JOINERS = new Set([
  "chopped", "tinned", "canned", "frozen", "fresh", "dried", "smoked", "sliced", "grated", "whole", "semi", "skimmed", "full", "fat", "low",
  "red", "green", "yellow", "white", "brown", "black", "wholemeal", "granary", "plain", "self", "raising", "sweet", "spring", "baked", "kidney",
  "baby", "new", "cherry", "plum", "chicken", "beef", "pork", "lamb", "vegetable", "olive", "sunflower", "vegetable", "washing", "toilet",
  "kitchen", "bin", "tea", "coffee", "ice", "peanut", "orange", "apple", "tomato", "garlic", "soy", "fish", "cheddar", "greek", "natural",
  "basmati", "long", "grain", "free", "range", "large", "small", "medium", "dishwasher", "hand", "shower", "fabric", "sandwich", "pitta", "pizza",
  "sausage", "hot", "cross", "crumpet", "custard", "double", "single", "sour", "soda", "sparkling", "still", "squash", "cat", "dog", "nappy", "baby",
]);
const NUMBERS = /^(\d+(\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|twelve|dozen|half)$/i;
// Common things that are several words long; matched first, longest wins
const PHRASES = [
  "washing up liquid", "toilet roll", "toilet rolls", "kitchen roll", "bin bags", "bin liners", "tea bags", "cling film", "tin foil", "baking paper",
  "cheddar cheese", "cream cheese", "ice cream", "olive oil", "sunflower oil", "vegetable oil", "peanut butter", "orange juice", "apple juice",
  "spring onions", "sweet potatoes", "baked beans", "kidney beans", "fish fingers", "chicken breasts", "chicken thighs", "minced beef", "beef mince",
  "garlic bread", "hot cross buns", "crumpets", "creme fraiche", "sour cream", "double cream", "single cream", "greek yoghurt", "natural yoghurt",
  "semi skimmed milk", "skimmed milk", "whole milk", "oat milk", "fabric softener", "dishwasher tablets", "hand soap", "shower gel", "cat food", "dog food",
  "free range eggs", "self raising flour", "plain flour", "brown bread", "white bread", "soy sauce", "tomato ketchup", "chopped tomatoes",
];
const UNITS = /^(kg|g|grams?|ml|l|litres?|pints?|packs?|packets?|tins?|cans?|bottles?|bags?|jars?|boxes?|tubs?|cartons?|bunch(es)?|heads?|loaf|loaves|punnets?|multipacks?|rolls?|dozen)$/i;

export function splitByWords(text: string): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let i = 0;
  while (i < words.length) {
    const start = i;
    const rest = words.slice(i).join(" ").toLowerCase();
    const phrase = PHRASES.filter((p) => rest === p || rest.startsWith(`${p} `)).sort((a, b) => b.length - a.length)[0];
    if (phrase) {
      i += phrase.split(" ").length;
      out.push(words.slice(start, i).join(" "));
      continue;
    }
    // "2 tins of tomatoes", "a dozen eggs", "six apples"
    const article = /^(a|an)$/i.test(words[i]) && i + 1 < words.length && UNITS.test(words[i + 1]);
    if (NUMBERS.test(words[i]) || article) {
      i++;
      if (i < words.length && UNITS.test(words[i])) i++;
      if (i < words.length && /^of$/i.test(words[i])) i++;
    }
    while (i < words.length - 1 && JOINERS.has(words[i].toLowerCase())) i++;
    i = Math.max(i + 1, start + 1);
    out.push(words.slice(start, i).join(" "));
  }
  return out;
}

// Returns the text with one item per line
export async function itemsFromSpeech(text: string): Promise<string> {
  const clean = text.trim();
  if (!clean || HAS_SEPARATORS.test(clean) || clean.split(/\s+/).length < 3) return clean;
  try {
    const reply = await Promise.race([
      askClaude({
        system:
          'Split a dictated UK shopping list into separate items. Keep quantities with their item ("2 tins of chopped tomatoes"). Fix obvious dictation mistakes only. Reply with JSON only: {"items":["..."]}',
        content: [{ type: "text", text: clean }],
        maxTokens: 400,
      }),
      new Promise<string>((_, reject) => setTimeout(() => reject(new Error("slow")), 7000)),
    ]);
    const items = parseJson<{ items: string[] }>(reply)?.items?.filter((s) => typeof s === "string" && s.trim());
    if (items?.length) return items.join("\n");
  } catch {
    /* fall back to the word list */
  }
  return splitByWords(clean).join("\n");
}
