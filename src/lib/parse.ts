// Turns "eggs, bread and 2 tins of tomatoes" into separate list items,
// and guesses a supermarket aisle for each. Shared with the Siri endpoint later.

export const AISLES = [
  "Fruit & veg",
  "Bakery",
  "Meat & fish",
  "Dairy & eggs",
  "Chilled",
  "Frozen",
  "Cupboard",
  "Drinks",
  "Household",
  "Toiletries & baby",
  "Other",
] as const;

export type Aisle = (typeof AISLES)[number];

const KEYWORDS: [Aisle, string[]][] = [
  ["Frozen", ["frozen", "ice cream", "fish fingers", "chips", "peas", "ice lolly", "lollies"]],
  ["Fruit & veg", ["apple", "banana", "orange", "lemon", "lime", "grape", "berr", "melon", "pear", "peach", "plum", "kiwi", "mango", "pineapple", "avocado", "tomato", "potato", "onion", "garlic", "carrot", "broccoli", "cauliflower", "lettuce", "salad", "spinach", "cucumber", "pepper", "courgette", "mushroom", "leek", "celery", "cabbage", "kale", "sweetcorn", "parsnip", "swede", "sweet potato", "ginger", "chilli", "herbs", "coriander", "parsley", "basil", "spring onion", "beansprout", "aubergine", "squash", "beetroot", "satsuma", "clementine"]],
  ["Bakery", ["bread", "loaf", "loaves", "roll", "bagel", "wrap", "tortilla", "pitta", "naan", "croissant", "crumpet", "muffin", "baguette", "brioche", "teacake"]],
  ["Meat & fish", ["chicken", "beef", "mince", "pork", "lamb", "bacon", "sausage", "ham", "turkey", "steak", "gammon", "salmon", "cod", "haddock", "tuna steak", "prawn", "fish", "chorizo", "salami", "duck"]],
  ["Dairy & eggs", ["milk", "cheese", "cheddar", "mozzarella", "parmesan", "feta", "halloumi", "butter", "yoghurt", "yogurt", "cream", "egg", "creme fraiche", "crème fraîche", "fromage"]],
  ["Chilled", ["hummus", "houmous", "fresh pasta", "pesto", "dip", "coleslaw", "quiche", "pizza", "tofu", "juice"]],
  ["Drinks", ["water", "squash", "cola", "lemonade", "coffee", "tea bags", "teabags", "tea", "wine", "beer", "gin", "prosecco", "tonic", "fizzy"]],
  ["Household", ["bin bag", "bin liner", "washing up", "dishwasher", "kitchen roll", "foil", "cling film", "clingfilm", "baking paper", "bleach", "cleaner", "sponge", "laundry", "detergent", "fabric softener", "toilet roll", "loo roll", "tissues", "batteries", "light bulb", "candles", "matches"]],
  ["Toiletries & baby", ["shampoo", "conditioner", "toothpaste", "toothbrush", "soap", "shower gel", "deodorant", "razor", "plasters", "paracetamol", "ibuprofen", "suncream", "sun cream", "nappies", "wipes", "cotton", "sanitary", "tampons", "moisturiser", "mouthwash", "floss"]],
  ["Cupboard", ["pasta", "spaghetti", "penne", "rice", "noodle", "flour", "sugar", "oil", "vinegar", "salt", "stock", "gravy", "tin", "beans", "chickpeas", "lentils", "tuna", "soup", "cereal", "porridge", "oats", "granola", "jam", "honey", "peanut butter", "marmite", "nutella", "biscuit", "crisps", "chocolate", "sauce", "ketchup", "mayo", "mustard", "spice", "paprika", "cumin", "curry", "passata", "coconut milk", "nuts", "raisins", "crackers", "custard", "jelly", "baking powder"]],
];

export function guessAisle(name: string): Aisle {
  const n = name.toLowerCase();
  for (const [aisle, words] of KEYWORDS) {
    if (words.some((w) => n.includes(w))) return aisle;
  }
  return "Other";
}

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, dozen: 12,
};

const UNITS =
  "kg|g|grams?|ml|l|litres?|liters?|pints?|packs?|packets?|tins?|cans?|bottles?|bags?|jars?|boxes?|tubs?|cartons?|bunch(?:es)?|heads?|loaves|loaf|punnets?|multipacks?";

const ITEM_RE = new RegExp(
  `^(\\d+(?:\\.\\d+)?|${Object.keys(NUMBER_WORDS).join("|")})\\s*(?:x\\s*)?(?:(${UNITS})\\b\\s*)?(?:of\\s+)?(.+)$`,
  "i",
);

export type ParsedItem = { name: string; quantity: number | null; unit: string | null; aisle: Aisle };

export function parseItems(text: string): ParsedItem[] {
  return text
    .split(/,|;|\n|\band\b|&|\bplus\b/i)
    .map((s) => s.trim().replace(/^(some|more)\s+/i, "").replace(/[.!]+$/, ""))
    .filter(Boolean)
    .map((piece) => {
      const m = piece.match(ITEM_RE);
      let name = piece;
      let quantity: number | null = null;
      let unit: string | null = null;
      if (m && m[3]) {
        const raw = m[1].toLowerCase();
        quantity = NUMBER_WORDS[raw] ?? Number(raw);
        unit = m[2] ? m[2].toLowerCase() : null;
        name = m[3].trim();
        // "a" or "an" on its own says nothing useful about quantity
        if ((raw === "a" || raw === "an") && !unit) quantity = null;
      }
      name = name.charAt(0).toUpperCase() + name.slice(1);
      return { name, quantity, unit, aisle: guessAisle(name) };
    });
}

export function formatQuantity(item: { quantity: number | null; unit: string | null }) {
  if (item.quantity == null) return "";
  const q = Number.isInteger(item.quantity) ? String(item.quantity) : String(item.quantity);
  if (!item.unit) return q;
  const compact = ["kg", "g", "ml", "l"].includes(item.unit);
  return compact ? `${q}${item.unit}` : `${q} ${item.unit}`;
}
