"use client";

import { useEffect, useMemo, useState } from "react";
import { fmt, fromIsoDay, isoDay } from "@/lib/dates";
import { splitPieces } from "@/lib/parse";
import { useDinners, type PlanRow, type Recipe, type ShopResult } from "@/lib/useDinners";
import { FeatureSheet } from "./FeatureSheet";

export type DinnerRequest = { k: "day"; date: string } | { k: "week" } | { k: "library" };

type View =
  | { k: "day"; date: string }
  | { k: "week" }
  | { k: "library"; pickFor?: string }
  | { k: "recipe"; id: string; pickFor?: string }
  | { k: "add"; pickFor?: string }
  | { k: "staples" };

const STAPLE_IDEAS = ["Salt", "Pepper", "Olive oil", "Vegetable oil", "Plain flour", "Sugar", "Stock cubes", "Dried herbs", "Water"];

const dayName = (iso: string) => fmt(fromIsoDay(iso), { weekday: "long", day: "numeric", month: "long" });
const shortDay = (iso: string) => fmt(fromIsoDay(iso), { weekday: "long" });

function host(url: string | null) {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function resultText(r: ShopResult) {
  if (r.dinners === 0) return "None of those dinners have a recipe yet.";
  const bits: string[] = [];
  if (r.added) bits.push(`Added ${r.added} ${r.added === 1 ? "thing" : "things"} to the shopping list.`);
  if (r.updated) bits.push(`${r.updated} ${r.updated === 1 ? "was" : "were"} already on it, so ${r.updated === 1 ? "it was" : "they were"} topped up.`);
  if (!r.added && !r.updated) bits.push("Nothing new to add.");
  if (r.skipped.length) bits.push(`Left off as staples: ${r.skipped.join(", ").toLowerCase()}.`);
  return bits.join(" ");
}

type Props = { request: DinnerRequest | null; onClose: () => void; householdId: string; days: { iso: string }[]; meId: string | null };

// Dinners: pick a recipe for a day, keep a recipe library, and put ingredients on the shopping list.
export function DinnersSheet({ request, onClose, householdId, days, meId }: Props) {
  const from = days[0]?.iso ?? isoDay(new Date());
  const to = days[days.length - 1]?.iso ?? from;
  const d = useDinners(householdId, from, to, request !== null);
  const [stack, setStack] = useState<View[]>([]);

  useEffect(() => {
    if (request) setStack([request.k === "day" ? { k: "day", date: request.date } : request.k === "week" ? { k: "week" } : { k: "library" }]);
  }, [request]);

  const view = stack[stack.length - 1] ?? null;
  const push = (v: View) => setStack((s) => [...s, v]);
  const replace = (v: View) => setStack((s) => [...s.slice(0, -1), v]);
  const back = stack.length > 1 ? () => setStack((s) => s.slice(0, -1)) : undefined;
  // After picking a recipe for a day, go back to that day
  const backToDay = (date: string) => setStack((s) => {
    const i = s.findIndex((v) => v.k === "day" && v.date === date);
    return i >= 0 ? s.slice(0, i + 1) : [...s, { k: "day", date }];
  });

  const title =
    !view ? "Dinners"
    : view.k === "day" ? `Dinner, ${dayName(view.date)}`
    : view.k === "week" ? "This week's dinners"
    : view.k === "library" ? (view.pickFor ? `Pick a recipe for ${shortDay(view.pickFor)}` : "Recipes")
    : view.k === "recipe" ? "Recipe"
    : view.k === "add" ? "Add a recipe"
    : "Staples";

  return (
    <FeatureSheet open={request !== null} title={title} onClose={() => { setStack([]); onClose(); }} onBack={back} className="dinners-sheet">
      {view?.k === "day" && <DayView key={view.date} date={view.date} d={d} meId={meId} push={push} />}
      {view?.k === "week" && <WeekView days={days} d={d} meId={meId} push={push} />}
      {view?.k === "library" && <Library d={d} pickFor={view.pickFor} push={push} onPicked={backToDay} />}
      {view?.k === "recipe" && <RecipeView key={view.id} id={view.id} d={d} pickFor={view.pickFor} onPicked={backToDay} onDeleted={() => back?.()} />}
      {view?.k === "add" && <AddRecipe d={d} pickFor={view.pickFor} onSaved={(r) => replace({ k: "recipe", id: r.id, pickFor: view.pickFor })} />}
      {view?.k === "staples" && <Staples d={d} />}
    </FeatureSheet>
  );
}

type D = ReturnType<typeof useDinners>;

function ShopButton({ label, rows, d, meId }: { label: string; rows: PlanRow[]; d: D; meId: string | null }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  return (
    <div className="fx-stack">
      <button
        type="button"
        className="btn btn-primary btn-big"
        disabled={busy || rows.length === 0}
        onClick={async () => {
          setBusy(true);
          try {
            setResult(resultText(await d.addToShopping(rows, meId)));
          } catch {
            setResult("That didn't work. Check the connection and try again.");
          }
          setBusy(false);
        }}
      >
        {busy ? "Adding…" : label}
      </button>
      {result && <p className="fx-result" role="status">{result}</p>}
    </div>
  );
}

function Servings({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="servings" role="group" aria-label="How many people">
      <span>Cooking for</span>
      <button type="button" className="icon-btn" onClick={() => onChange(Math.max(1, value - 1))} aria-label="Fewer people">−</button>
      <strong aria-live="polite">{value}</strong>
      <button type="button" className="icon-btn" onClick={() => onChange(Math.min(30, value + 1))} aria-label="More people">+</button>
    </div>
  );
}

function RecipeCard({ r, onClick }: { r: Recipe; onClick?: () => void }) {
  const inner = (
    <>
      {r.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="rc-img" src={r.image_url} alt="" loading="lazy" referrerPolicy="no-referrer" />
      ) : (
        <span className="rc-img rc-blank" aria-hidden="true">🍽</span>
      )}
      <span className="fx-row-text">
        <strong>{r.title}</strong>
        <span className="fx-sub">{[r.servings ? `Serves ${r.servings}` : null, `${r.ingredients.length} ingredients`, host(r.source_url)].filter(Boolean).join(" · ")}</span>
      </span>
    </>
  );
  return onClick ? (
    <button type="button" className="fx-row fx-link recipe-card" onClick={onClick}>{inner}<span className="fx-chev" aria-hidden="true">›</span></button>
  ) : (
    <div className="fx-row fx-link recipe-card">{inner}</div>
  );
}

function DayView({ date, d, meId, push }: { date: string; d: D; meId: string | null; push: (v: View) => void }) {
  const row = d.plan.find((p) => p.date === date);
  const recipe = d.recipes.find((r) => r.id === row?.recipe_id);
  const [note, setNote] = useState(row?.note ?? "");
  useEffect(() => setNote(row?.note ?? ""), [row?.note]);
  const people = row?.servings ?? recipe?.servings ?? 4;

  if (!d.loaded) return <p className="fx-empty">Loading…</p>;

  if (recipe && row) {
    return (
      <>
        <RecipeCard r={recipe} onClick={() => push({ k: "recipe", id: recipe.id })} />
        <Servings value={people} onChange={(n) => d.setServings(row.id, n)} />
        <ShopButton label="Add ingredients to the shopping list" rows={[{ ...row, servings: people }]} d={d} meId={meId} />
        <div className="sheet-actions">
          <button type="button" className="btn btn-soft" onClick={() => push({ k: "library", pickFor: date })}>Choose a different recipe</button>
          <button type="button" className="btn btn-quiet" onClick={() => d.setNote(date, "")}>Clear this dinner</button>
        </div>
        <button type="button" className="btn btn-quiet btn-left" onClick={() => push({ k: "week" })}>See the whole week</button>
      </>
    );
  }

  return (
    <>
      <form className="add-bar" onSubmit={(e) => { e.preventDefault(); void d.setNote(date, note); }}>
        <input aria-label="What's for dinner?" placeholder="What's for dinner?" value={note} onChange={(e) => setNote(e.target.value)} enterKeyHint="done" />
        <button className="btn btn-primary" disabled={note.trim() === (row?.note ?? "")}>Save</button>
      </form>
      <h3 className="me-label">Or pick a recipe</h3>
      <RecipeList d={d} onPick={(r) => d.setRecipe(date, r.id, r.servings)} limit={6} onMore={() => push({ k: "library", pickFor: date })} />
      <div className="sheet-actions">
        <button type="button" className="btn btn-soft" onClick={() => push({ k: "add", pickFor: date })}>+ Add a recipe from a link</button>
        <span className="spacer" />
        <button type="button" className="btn btn-quiet" onClick={() => push({ k: "week" })}>Whole week</button>
      </div>
    </>
  );
}

function RecipeList({ d, onPick, limit, onMore }: { d: D; onPick: (r: Recipe) => void; limit?: number; onMore?: () => void }) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return d.recipes.filter((r) => !t || r.title.toLowerCase().includes(t) || r.ingredients.some((i) => i.toLowerCase().includes(t)));
  }, [d.recipes, q]);
  if (d.recipes.length === 0) return <p className="fx-empty">No recipes saved yet. Paste a link to one from BBC Good Food, a blog or most recipe sites.</p>;
  const list = limit && !q ? shown.slice(0, limit) : shown;
  return (
    <>
      {d.recipes.length > 5 && <input aria-label="Search recipes" placeholder="Search recipes or ingredients" value={q} onChange={(e) => setQ(e.target.value)} type="search" />}
      <ul className="fx-rows">
        {list.map((r) => (
          <li key={r.id}><RecipeCard r={r} onClick={() => onPick(r)} /></li>
        ))}
        {list.length === 0 && <li className="fx-empty">No recipes match.</li>}
      </ul>
      {onMore && limit && !q && shown.length > limit && (
        <button type="button" className="btn btn-quiet btn-left" onClick={onMore}>See all {shown.length} recipes</button>
      )}
    </>
  );
}

function WeekView({ days, d, meId, push }: { days: { iso: string }[]; d: D; meId: string | null; push: (v: View) => void }) {
  const today = isoDay(new Date());
  const ahead = d.plan.filter((p) => p.recipe_id && p.date >= today && days.some((x) => x.iso === p.date));
  return (
    <>
      <ul className="fx-rows">
        {days.map(({ iso }) => {
          const p = d.plan.find((x) => x.date === iso);
          const r = d.recipes.find((x) => x.id === p?.recipe_id);
          return (
            <li key={iso}>
              <button type="button" className={`fx-row fx-link week-dinner${iso < today ? " is-past" : ""}`} onClick={() => push({ k: "day", date: iso })}>
                <span className="wd-day">{fmt(fromIsoDay(iso), { weekday: "short" })} <span>{fromIsoDay(iso).getDate()}</span></span>
                <span className="fx-row-text">
                  <strong className={p ? "" : "fx-muted"}>{r?.title ?? p?.note ?? "Nothing planned"}</strong>
                  {r && <span className="fx-sub">Recipe{p?.servings ? ` · for ${p.servings}` : ""}</span>}
                </span>
                <span className="fx-chev" aria-hidden="true">›</span>
              </button>
            </li>
          );
        })}
      </ul>
      <ShopButton
        label={ahead.length ? `Add ingredients for ${ahead.length} ${ahead.length === 1 ? "dinner" : "dinners"}` : "Add ingredients to the shopping list"}
        rows={ahead}
        d={d}
        meId={meId}
      />
      {ahead.length === 0 && <p className="sheet-hint">Pick recipes for the days ahead and their ingredients can go on the shopping list in one go.</p>}
      <div className="sheet-actions">
        <button type="button" className="btn btn-soft" onClick={() => push({ k: "library" })}>Recipes</button>
        <button type="button" className="btn btn-soft" onClick={() => push({ k: "staples" })}>Staples</button>
      </div>
    </>
  );
}

function Library({ d, pickFor, push, onPicked }: { d: D; pickFor?: string; push: (v: View) => void; onPicked: (date: string) => void }) {
  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => push({ k: "add", pickFor })}>+ Add a recipe</button>
      <RecipeList
        d={d}
        onPick={async (r) => {
          if (pickFor) {
            await d.setRecipe(pickFor, r.id, r.servings);
            onPicked(pickFor);
          } else push({ k: "recipe", id: r.id });
        }}
      />
      {!pickFor && <button type="button" className="btn btn-quiet btn-left" onClick={() => push({ k: "staples" })}>Staples (left off shopping lists)</button>}
    </>
  );
}

function RecipeView({ id, d, pickFor, onPicked, onDeleted }: { id: string; d: D; pickFor?: string; onPicked: (date: string) => void; onDeleted: () => void }) {
  const r = d.recipes.find((x) => x.id === id);
  const [planDate, setPlanDate] = useState(pickFor ?? isoDay(new Date()));
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [planned, setPlanned] = useState<string | null>(null);
  if (!r) return <p className="fx-empty">{d.loaded ? "That recipe has gone." : "Loading…"}</p>;
  if (editing) return <RecipeForm d={d} recipe={r} onSaved={() => setEditing(false)} />;

  return (
    <>
      {r.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="recipe-hero" src={r.image_url} alt="" referrerPolicy="no-referrer" />
      )}
      <h3 className="fx-big">{r.title}</h3>
      <p className="sheet-hint">
        {[r.servings ? `Serves ${r.servings}` : null].filter(Boolean).join(" · ")}
        {r.source_url && (
          <>
            {r.servings ? " · " : ""}
            <a href={r.source_url} target="_blank" rel="noopener noreferrer">From {host(r.source_url)}</a>
          </>
        )}
      </p>

      <div className="plan-it">
        {pickFor ? null : (
          <label className="field">
            <span>Have it for dinner on</span>
            <input type="date" value={planDate} onChange={(e) => setPlanDate(e.target.value)} />
          </label>
        )}
        <button
          type="button"
          className="btn btn-primary btn-big"
          disabled={busy || !planDate}
          onClick={async () => {
            setBusy(true);
            await d.setRecipe(planDate, r.id, r.servings);
            setBusy(false);
            if (pickFor) onPicked(pickFor);
            else setPlanned(planDate);
          }}
        >
          {pickFor ? `Have this on ${shortDay(pickFor)}` : "Plan it"}
        </button>
      </div>
      {planned && <p className="fx-result" role="status">On the plan for {dayName(planned)}.</p>}

      <h3 className="me-label">Ingredients</h3>
      <ul className="recipe-ingredients">
        {r.ingredients.map((i, n) => <li key={n}>{i}</li>)}
      </ul>
      {r.method.length > 0 && (
        <>
          <h3 className="me-label">Method</h3>
          <ol className="recipe-method">
            {r.method.map((m, n) => (m.startsWith("# ") ? <li key={n} className="is-heading">{m.slice(2)}</li> : <li key={n}>{m}</li>))}
          </ol>
        </>
      )}
      <div className="sheet-actions">
        <button
          type="button"
          className="btn btn-danger"
          onClick={async () => {
            if (!confirm(`Delete the recipe “${r.title}”? Dinners already planned with it keep their name.`)) return;
            await d.deleteRecipe(r.id);
            onDeleted();
          }}
        >
          Delete recipe
        </button>
        <span className="spacer" />
        <button type="button" className="btn btn-soft" onClick={() => setEditing(true)}>Edit</button>
      </div>
    </>
  );
}

function AddRecipe({ d, pickFor, onSaved }: { d: D; pickFor?: string; onSaved: (r: Recipe) => void }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState(false);

  if (manual) return <RecipeForm d={d} sourceUrl={url.trim() || null} onSaved={onSaved} />;

  return (
    <form
      className="fx-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!url.trim()) return;
        setBusy(true);
        setError(null);
        const res = await d.importRecipe(url);
        setBusy(false);
        if (res.recipe) onSaved(res.recipe);
        else setError(res.error ?? "That didn't work.");
      }}
    >
      <p className="sheet-hint">Paste a link to a recipe page. The ingredients, method and picture are saved here{pickFor ? `, then you can have it on ${shortDay(pickFor)}` : ""}.</p>
      <label className="field">
        <span>Recipe link</span>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.bbcgoodfood.com/recipes/…" inputMode="url" autoComplete="off" autoFocus />
      </label>
      {error && <p className="login-error" role="alert">{error}</p>}
      <div className="sheet-actions">
        <button type="button" className="btn btn-quiet" onClick={() => setManual(true)}>Type one in instead</button>
        <span className="spacer" />
        <button className="btn btn-primary btn-big" disabled={busy || !url.trim()}>{busy ? "Getting it…" : "Get recipe"}</button>
      </div>
    </form>
  );
}

function RecipeForm({ d, recipe, sourceUrl, onSaved }: { d: D; recipe?: Recipe; sourceUrl?: string | null; onSaved: (r: Recipe) => void }) {
  const [title, setTitle] = useState(recipe?.title ?? "");
  const [servings, setServings] = useState(String(recipe?.servings ?? 4));
  const [ingredients, setIngredients] = useState(recipe?.ingredients.join("\n") ?? "");
  const [method, setMethod] = useState(recipe?.method.join("\n") ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="fx-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        setBusy(true);
        setError(null);
        try {
          const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
          const saved = await d.saveRecipe({
            id: recipe?.id,
            title,
            servings: Number(servings) || null,
            ingredients: lines(ingredients),
            method: lines(method),
            source_url: recipe ? recipe.source_url : sourceUrl ?? null,
          });
          if (saved) onSaved(saved);
        } catch {
          setError("That didn't save. Check the connection and try again.");
        }
        setBusy(false);
      }}
    >
      <input className="title-input" aria-label="Recipe name" placeholder="Recipe name" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <div className="field-row">
        <label className="field">
          <span>Serves</span>
          <input inputMode="numeric" value={servings} onChange={(e) => setServings(e.target.value.replace(/\D/g, ""))} />
        </label>
      </div>
      <label className="field">
        <span>Ingredients, one per line</span>
        <textarea rows={7} value={ingredients} onChange={(e) => setIngredients(e.target.value)} placeholder={"500g beef mince\n2 onions\n1 tin chopped tomatoes"} />
      </label>
      <label className="field">
        <span>Method (optional)</span>
        <textarea rows={5} value={method} onChange={(e) => setMethod(e.target.value)} />
      </label>
      {error && <p className="login-error" role="alert">{error}</p>}
      <div className="sheet-actions">
        <span className="spacer" />
        <button className="btn btn-primary btn-big" disabled={busy || !title.trim()}>{busy ? "Saving…" : "Save recipe"}</button>
      </div>
    </form>
  );
}

function Staples({ d }: { d: D }) {
  const [text, setText] = useState("");
  const ideas = STAPLE_IDEAS.filter((s) => !d.staples.some((x) => x.name.toLowerCase() === s.toLowerCase()));
  return (
    <>
      <p className="sheet-hint">Things you always have in. They&apos;re left off when a recipe&apos;s ingredients go on the shopping list.</p>
      <form className="add-bar" onSubmit={(e) => { e.preventDefault(); void d.addStaples(splitPieces(text)); setText(""); }}>
        <input aria-label="Add staples" placeholder="Salt, olive oil and flour" value={text} onChange={(e) => setText(e.target.value)} enterKeyHint="done" />
        <button className="btn btn-primary" disabled={!text.trim()}>Add</button>
      </form>
      {d.staples.length > 0 ? (
        <ul className="staples">
          {d.staples.map((s) => (
            <li key={s.id}>
              <span>{s.name}</span>
              <button type="button" onClick={() => d.removeStaple(s.id)} aria-label={`Remove ${s.name}`}>✕</button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="fx-empty">No staples yet.</p>
      )}
      {ideas.length > 0 && (
        <>
          <h3 className="me-label">Ideas</h3>
          <div className="usuals">
            {ideas.map((s) => (
              <button key={s} type="button" className="chip" onClick={() => d.addStaples([s])}>+ {s}</button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
