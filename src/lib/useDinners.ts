"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { planShopping, shoppingLines, type ListItem } from "@/lib/ingredients";

export type Recipe = {
  id: string;
  household_id: string;
  title: string;
  source_url: string | null;
  image_url: string | null;
  servings: number | null;
  ingredients: string[];
  method: string[];
  created_at: string;
};

export type PlanRow = { id: string; date: string; note: string | null; recipe_id: string | null; servings: number | null };

export type ShopResult = { added: number; updated: number; skipped: string[]; dinners: number };

const asStrings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

// Recipes, staples and the dinner plan for a range of dates
export function useDinners(householdId: string | null, from: string, to: string, active: boolean) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [staples, setStaples] = useState<{ id: string; name: string }[]>([]);
  const [plan, setPlan] = useState<PlanRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!householdId) return;
    const sb = getSupabase();
    const [{ data: r }, { data: s }, { data: p }] = await Promise.all([
      sb.from("recipes").select("*").eq("household_id", householdId).order("title"),
      sb.from("staples").select("id,name").eq("household_id", householdId).order("name"),
      sb.from("meal_plan").select("id,date,note,recipe_id,servings").eq("household_id", householdId).gte("date", from).lte("date", to),
    ]);
    if (r) setRecipes((r as Recipe[]).map((x) => ({ ...x, ingredients: asStrings(x.ingredients), method: asStrings(x.method) })));
    if (s) setStaples(s as { id: string; name: string }[]);
    if (p) setPlan(p as PlanRow[]);
    setLoaded(true);
  }, [householdId, from, to]);

  useEffect(() => {
    if (active) void load();
  }, [active, load]);

  const setRecipe = useCallback(
    async (date: string, recipeId: string, servings: number | null) => {
      if (!householdId) return;
      await getSupabase().from("meal_plan").upsert({ household_id: householdId, date, recipe_id: recipeId, note: null, servings }, { onConflict: "household_id,date" });
      await load();
    },
    [householdId, load],
  );

  const setNote = useCallback(
    async (date: string, note: string) => {
      if (!householdId) return;
      const text = note.trim();
      if (!text) await getSupabase().from("meal_plan").delete().eq("household_id", householdId).eq("date", date);
      else await getSupabase().from("meal_plan").upsert({ household_id: householdId, date, note: text, recipe_id: null, servings: null }, { onConflict: "household_id,date" });
      await load();
    },
    [householdId, load],
  );

  const setServings = useCallback(
    async (planId: string, servings: number) => {
      setPlan((prev) => prev.map((p) => (p.id === planId ? { ...p, servings } : p)));
      await getSupabase().from("meal_plan").update({ servings }).eq("id", planId);
    },
    [],
  );

  const saveRecipe = useCallback(
    async (r: Pick<Recipe, "title" | "servings" | "ingredients" | "method" | "source_url"> & { id?: string }) => {
      if (!householdId) return null;
      const row = { household_id: householdId, title: r.title.trim().slice(0, 200), servings: r.servings, ingredients: r.ingredients, method: r.method, source_url: r.source_url };
      const { data, error } = r.id
        ? await getSupabase().from("recipes").update(row).eq("id", r.id).select("*").single()
        : await getSupabase().from("recipes").insert(row).select("*").single();
      if (error) throw error;
      await load();
      return data as Recipe;
    },
    [householdId, load],
  );

  const deleteRecipe = useCallback(
    async (id: string) => {
      // Dinners planned with it keep their day, showing the name as a note
      const r = recipes.find((x) => x.id === id);
      if (r) await getSupabase().from("meal_plan").update({ note: r.title }).eq("recipe_id", id).is("note", null);
      await getSupabase().from("recipes").delete().eq("id", id);
      await load();
    },
    [recipes, load],
  );

  const importRecipe = useCallback(
    async (url: string): Promise<{ recipe?: Recipe; error?: string; noRecipe?: boolean }> => {
      try {
        const res = await fetch("/api/recipes/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) });
        const data = await res.json();
        if (!res.ok) return { error: data.error ?? "That didn't work.", noRecipe: Boolean(data.noRecipe) };
        await load();
        return { recipe: { ...data.recipe, ingredients: asStrings(data.recipe.ingredients), method: asStrings(data.recipe.method) } };
      } catch {
        return { error: "That didn't work. Check the connection and try again." };
      }
    },
    [load],
  );

  const addStaples = useCallback(
    async (names: string[]) => {
      if (!householdId) return;
      const fresh = names.map((n) => n.trim()).filter((n) => n && !staples.some((s) => s.name.toLowerCase() === n.toLowerCase()));
      if (fresh.length) await getSupabase().from("staples").upsert(fresh.map((name) => ({ household_id: householdId, name })), { onConflict: "household_id,name", ignoreDuplicates: true });
      await load();
    },
    [householdId, staples, load],
  );

  const removeStaple = useCallback(
    async (id: string) => {
      setStaples((prev) => prev.filter((s) => s.id !== id));
      await getSupabase().from("staples").delete().eq("id", id);
    },
    [],
  );

  // Puts the ingredients for some dinners on the shopping list
  const addToShopping = useCallback(
    async (rows: PlanRow[], addedBy: string | null): Promise<ShopResult> => {
      if (!householdId) return { added: 0, updated: 0, skipped: [], dinners: 0 };
      const client = getSupabase();
      const withRecipes = rows.map((p) => ({ p, r: recipes.find((r) => r.id === p.recipe_id) })).filter((x) => x.r);
      const wanted = withRecipes.flatMap(({ p, r }) => {
        const base = r!.servings || p.servings || 4;
        const scale = (p.servings || base) / base;
        return shoppingLines(r!.ingredients, scale).map((l) => ({ ...l, mealPlanId: p.id }));
      });
      const [{ data: list }, { data: st }] = await Promise.all([
        client.from("shopping_items").select("id,name,quantity,unit,checked").eq("household_id", householdId),
        client.from("staples").select("name").eq("household_id", householdId),
      ]);
      const items = ((list ?? []) as ListItem[]).map((i) => ({ ...i, quantity: i.quantity == null ? null : Number(i.quantity) }));
      const { plans, skipped } = planShopping(wanted, items, (st ?? []).map((s) => s.name as string));

      const inserts = plans.flatMap((p) =>
        p.kind === "insert"
          ? [{ id: crypto.randomUUID(), household_id: householdId, name: p.name, quantity: p.quantity, unit: p.unit, aisle: p.aisle, checked: false, usual: false, meal_plan_id: p.mealPlanId, added_by: addedBy }]
          : [],
      );
      if (inserts.length) {
        const { error } = await client.from("shopping_items").insert(inserts);
        if (error) throw error;
      }
      let updated = 0;
      for (const p of plans) {
        if (p.kind !== "update") continue;
        const before = items.find((i) => i.id === p.id);
        const patch = p.reopen
          ? { quantity: p.quantity, unit: p.unit, checked: false, checked_at: null, added_by: addedBy, meal_plan_id: p.mealPlanId }
          : { quantity: p.quantity, unit: p.unit };
        if (!p.reopen && before && before.quantity === p.quantity && before.unit === p.unit) {
          updated++;
          continue;
        }
        await client.from("shopping_items").update(patch).eq("id", p.id);
        updated++;
      }
      return { added: inserts.length, updated, skipped: [...new Set(skipped)], dinners: withRecipes.length };
    },
    [householdId, recipes],
  );

  return { recipes, staples, plan, loaded, reload: load, setRecipe, setNote, setServings, saveRecipe, deleteRecipe, importRecipe, addStaples, removeStaple, addToShopping };
}
