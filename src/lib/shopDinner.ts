"use client";

import { getSupabase } from "@/lib/supabase/client";
import { planShopping, shoppingLines, type ListItem } from "@/lib/ingredients";

// One-tap "add this dinner's ingredients to the shopping list", reading everything fresh
// so it works straight after a recipe has been picked.
export async function shopForDinner(householdId: string, date: string, addedBy: string | null): Promise<string> {
  const sb = getSupabase();
  const { data: row } = await sb.from("meal_plan").select("id,servings,recipe_id,recipes(title,servings,ingredients)").eq("household_id", householdId).eq("date", date).maybeSingle();
  const recipe = (row?.recipes ?? null) as unknown as { title: string; servings: number | null; ingredients: unknown } | null;
  if (!row || !recipe) return "That dinner doesn't have a recipe yet.";
  const lines = Array.isArray(recipe.ingredients) ? recipe.ingredients.filter((x): x is string => typeof x === "string") : [];
  const base = recipe.servings || row.servings || 4;
  const wanted = shoppingLines(lines, (row.servings || base) / base).map((l) => ({ ...l, mealPlanId: row.id as string }));

  const [{ data: list }, { data: st }] = await Promise.all([
    sb.from("shopping_items").select("id,name,quantity,unit,checked").eq("household_id", householdId),
    sb.from("staples").select("name").eq("household_id", householdId),
  ]);
  const items = ((list ?? []) as ListItem[]).map((i) => ({ ...i, quantity: i.quantity == null ? null : Number(i.quantity) }));
  const { plans } = planShopping(wanted, items, (st ?? []).map((s) => s.name as string));

  const inserts = plans.flatMap((p) =>
    p.kind === "insert"
      ? [{ id: crypto.randomUUID(), household_id: householdId, name: p.name, quantity: p.quantity, unit: p.unit, aisle: p.aisle, checked: false, usual: false, meal_plan_id: p.mealPlanId, added_by: addedBy }]
      : [],
  );
  if (inserts.length) {
    const { error } = await sb.from("shopping_items").insert(inserts);
    if (error) return "That didn't work. Check the connection and try again.";
  }
  let updated = 0;
  for (const p of plans) {
    if (p.kind !== "update") continue;
    const patch = p.reopen
      ? { quantity: p.quantity, unit: p.unit, checked: false, checked_at: null, added_by: addedBy, meal_plan_id: p.mealPlanId }
      : { quantity: p.quantity, unit: p.unit };
    await sb.from("shopping_items").update(patch).eq("id", p.id);
    updated++;
  }
  if (!inserts.length && !updated) return `Everything for ${recipe.title} is already on the list or in the cupboard.`;
  return `Added ${inserts.length} item${inserts.length === 1 ? "" : "s"} for ${recipe.title}${updated ? `, and topped up ${updated}` : ""}.`;
}
