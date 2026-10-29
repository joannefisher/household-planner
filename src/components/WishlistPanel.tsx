"use client";

import { useEffect, useMemo, useState } from "react";
import { fmt, fromIsoDay, isoDay } from "@/lib/dates";
import type { Member } from "@/lib/types";
import { useWishlists, type WishItem, type Wishlist } from "@/lib/useWishlists";
import { Avatar } from "./Avatar";
import { FeatureSheet } from "./FeatureSheet";

const PICK_KEY = "planner.wishlist";

const money = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);

function occasion(date: string | null) {
  if (!date) return null;
  const today = isoDay(new Date());
  const days = Math.round((fromIsoDay(date).getTime() - fromIsoDay(today).getTime()) / 864e5);
  const when = fmt(fromIsoDay(date), { day: "numeric", month: "long" });
  if (days < 0) return when;
  if (days === 0) return `${when}, today`;
  return `${when}, in ${days} ${days === 1 ? "day" : "days"}`;
}

function siteName(link: string) {
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return "link";
  }
}

// Gift ideas for birthdays, Christmas and so on. Only shown on adults' phones.
export function WishlistPanel({ householdId, members, photos, me }: { householdId: string; members: Member[]; photos: Record<string, string>; me: Member | null }) {
  const w = useWishlists(householdId);
  const [picked, setPicked] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<WishItem | null>(null);
  const [listSheet, setListSheet] = useState<{ list: Wishlist | null } | null>(null);

  useEffect(() => {
    try {
      setPicked(localStorage.getItem(PICK_KEY));
    } catch {}
  }, []);
  const pick = (id: string) => {
    setPicked(id);
    try {
      localStorage.setItem(PICK_KEY, id);
    } catch {}
  };

  const list = w.lists.find((l) => l.id === picked) ?? w.lists[0] ?? null;
  const forWho = members.find((m) => m.id === list?.for_member_id);
  const { ideas, bought, ideasTotal, boughtTotal } = useMemo(() => {
    const mine = w.items.filter((i) => i.wishlist_id === list?.id);
    const ideas = mine.filter((i) => !i.bought);
    const bought = mine.filter((i) => i.bought);
    const sum = (xs: WishItem[]) => xs.reduce((t, i) => t + (i.price ?? 0), 0);
    return { ideas, bought, ideasTotal: sum(ideas), boughtTotal: sum(bought) };
  }, [w.items, list?.id]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!list || !text.trim()) return;
    w.addText(list.id, text, me?.id ?? null);
    setText("");
  }

  return (
    <section className="list wish" aria-label="Gift ideas">
      <div className="list-head">
        <h2 className="panel-title">Gift ideas</h2>
        <span className="list-count">Just for grown-ups</span>
      </div>

      {w.loaded && w.lists.length === 0 ? (
        <div className="todo-start">
          <p className="fx-empty">Keep present ideas for birthdays and Christmas here. They only show on grown-ups&apos; phones, never on the kitchen screen.</p>
          <button className="btn btn-primary" onClick={() => setListSheet({ list: null })}>+ New wishlist</button>
        </div>
      ) : (
        <>
          <div className="todo-lists" role="tablist" aria-label="Wishlists">
            {w.lists.map((l) => {
              const m = members.find((x) => x.id === l.for_member_id);
              return (
                <button key={l.id} role="tab" aria-selected={l.id === list?.id} className={`todo-tab${l.id === list?.id ? " is-on" : ""}`} onClick={() => pick(l.id)}>
                  {m ? <Avatar member={m} size={26} photoUrl={photos[m.id]} /> : <span aria-hidden="true">🎁</span>}
                  {l.name}
                </button>
              );
            })}
            <button className="todo-tab is-new" onClick={() => setListSheet({ list: null })}>+ New</button>
          </div>

          {list && (
            <>
              <div className="wish-info">
                <span>
                  {forWho ? `For ${forWho.name}` : "For anyone"}
                  {list.occasion_date ? ` · ${occasion(list.occasion_date)}` : ""}
                </span>
                {(ideasTotal > 0 || boughtTotal > 0) && (
                  <span className="wish-totals">
                    {boughtTotal > 0 && `${money(boughtTotal)} bought`}
                    {boughtTotal > 0 && ideasTotal > 0 && " · "}
                    {ideasTotal > 0 && `${money(ideasTotal)} of ideas`}
                  </span>
                )}
              </div>
              <div className="todo-bar">
                <form className="add-bar" onSubmit={submit}>
                  <input aria-label={`Add ideas to ${list.name}`} placeholder="Lego, a scooter and books" value={text} onChange={(e) => setText(e.target.value)} enterKeyHint="done" autoComplete="off" />
                  <button className="btn btn-primary" disabled={!text.trim()}>Add</button>
                </form>
                <button className="icon-btn todo-more" onClick={() => setListSheet({ list })} aria-label={`Change or delete ${list.name}`}>⋯</button>
              </div>
              {w.error && <p className="sync-note" role="alert">{w.error}</p>}

              <div className="list-scroll">
                {ideas.length === 0 && bought.length === 0 && <p className="empty">No ideas yet. Tap an idea after adding it to save a link or price.</p>}
                <ul className="todo-items">
                  {ideas.map((i) => (
                    <WishRow key={i.id} item={i} members={members} photos={photos} onToggle={() => w.updateItem(i.id, { bought: true, bought_by: me?.id ?? null })} onEdit={() => setEditing(i)} />
                  ))}
                </ul>
                {bought.length > 0 && (
                  <div className="aisle trolley">
                    <h3 className="aisle-name">Bought</h3>
                    <ul className="todo-items">
                      {bought.map((i) => (
                        <WishRow key={i.id} item={i} members={members} photos={photos} onToggle={() => w.updateItem(i.id, { bought: false, bought_by: null })} onEdit={() => setEditing(i)} />
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      <FeatureSheet open={editing !== null} title="Gift idea" onClose={() => setEditing(null)}>
        {editing && (
          <EditIdea
            key={editing.id}
            item={editing}
            members={members}
            meId={me?.id ?? null}
            onSave={(patch) => { w.updateItem(editing.id, patch); setEditing(null); }}
            onDelete={() => { w.removeItem(editing.id); setEditing(null); }}
          />
        )}
      </FeatureSheet>

      <FeatureSheet open={listSheet !== null} title={listSheet?.list ? "Change wishlist" : "New wishlist"} onClose={() => setListSheet(null)}>
        {listSheet && (
          <EditWishlist
            key={listSheet.list?.id ?? "new"}
            list={listSheet.list}
            members={members}
            photos={photos}
            onSave={(patch) => {
              if (listSheet.list) w.updateList(listSheet.list.id, patch);
              else {
                const id = w.addList(patch);
                if (id) pick(id);
              }
              setListSheet(null);
            }}
            onDelete={() => {
              if (listSheet.list) w.deleteList(listSheet.list.id);
              setListSheet(null);
            }}
          />
        )}
      </FeatureSheet>
    </section>
  );
}

function WishRow({ item, members, photos, onToggle, onEdit }: { item: WishItem; members: Member[]; photos: Record<string, string>; onToggle: () => void; onEdit: () => void }) {
  const by = members.find((m) => m.id === item.bought_by);
  return (
    <li className={`item todo-item${item.bought ? " is-checked" : ""}`}>
      <button className="todo-tick" onClick={onToggle} aria-pressed={item.bought} aria-label={item.bought ? `Mark ${item.title} as not bought` : `Mark ${item.title} as bought`}>
        <span className="tick" aria-hidden="true">{item.bought ? "✓" : ""}</span>
      </button>
      <button className="item-main todo-main" onClick={onEdit}>
        <span className="item-name">
          {item.title}
          {(item.link || item.notes) && <span className="todo-due">{[item.link ? siteName(item.link) : null, item.notes].filter(Boolean).join(" · ")}</span>}
        </span>
        {item.price != null && <span className="item-qty">{money(item.price)}</span>}
        {by && <span className="item-by" title={`Bought by ${by.name}`}><Avatar member={by} size={24} photoUrl={photos[by.id]} /></span>}
      </button>
      {item.link && (
        <a className="item-edit wish-open" href={item.link} target="_blank" rel="noopener noreferrer" aria-label={`Open the link for ${item.title}`}>Open</a>
      )}
    </li>
  );
}

function EditIdea({ item, members, meId, onSave, onDelete }: { item: WishItem; members: Member[]; meId: string | null; onSave: (p: Partial<WishItem>) => void; onDelete: () => void }) {
  const [title, setTitle] = useState(item.title);
  const [link, setLink] = useState(item.link ?? "");
  const [price, setPrice] = useState(item.price?.toString() ?? "");
  const [notes, setNotes] = useState(item.notes ?? "");
  const [bought, setBought] = useState(item.bought);
  const [error, setError] = useState<string | null>(null);
  const by = members.find((m) => m.id === item.bought_by);

  return (
    <form
      className="fx-stack"
      onSubmit={(e) => {
        e.preventDefault();
        let url = link.trim();
        if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
        if (url) {
          try {
            new URL(url);
          } catch {
            setError("That link doesn't look right.");
            return;
          }
        }
        const p = price.trim() ? Number(price.replace(/[£,\s]/g, "")) : null;
        onSave({
          title: title.trim() || item.title,
          link: url || null,
          price: p != null && Number.isFinite(p) ? Math.round(p * 100) / 100 : null,
          notes: notes.trim() || null,
          bought,
          bought_by: bought ? (item.bought ? item.bought_by : meId) : null,
        });
      }}
    >
      <input className="title-input" aria-label="Idea" value={title} onChange={(e) => setTitle(e.target.value)} />
      <label className="field">
        <span>Link (optional)</span>
        <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Paste a shop link" inputMode="url" autoComplete="off" />
      </label>
      <div className="field-row">
        <label className="field">
          <span>Price (£)</span>
          <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.,£]/g, ""))} inputMode="decimal" placeholder="25" />
        </label>
      </div>
      <label className="field">
        <span>Notes</span>
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Size 9, the blue one" />
      </label>
      <label className="switch">
        <input type="checkbox" checked={bought} onChange={(e) => setBought(e.target.checked)} />
        <span>Bought{item.bought && by ? ` (by ${by.name})` : ""}</span>
      </label>
      {error && <p className="login-error" role="alert">{error}</p>}
      <div className="sheet-actions">
        <button type="button" className="btn btn-danger" onClick={onDelete}>Delete</button>
        <span className="spacer" />
        <button className="btn btn-primary btn-big">Save</button>
      </div>
    </form>
  );
}

function EditWishlist({
  list,
  members,
  photos,
  onSave,
  onDelete,
}: {
  list: Wishlist | null;
  members: Member[];
  photos: Record<string, string>;
  onSave: (p: Pick<Wishlist, "name" | "for_member_id" | "occasion_date">) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(list?.name ?? "");
  const [forId, setForId] = useState<string | null>(list?.for_member_id ?? null);
  const [date, setDate] = useState(list?.occasion_date ?? "");
  // Picking a person fills in "Name's birthday" unless a name has been typed
  const suggestion = (m: Member) => {
    if (!name.trim() || members.some((x) => name === `${x.name}'s birthday`)) setName(`${m.name}'s birthday`);
  };

  return (
    <form
      className="fx-stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onSave({ name: name.trim(), for_member_id: forId, occasion_date: date || null });
      }}
    >
      <input className="title-input" aria-label="Wishlist name" placeholder="Christmas, Millie's birthday…" value={name} onChange={(e) => setName(e.target.value)} autoFocus={!list} maxLength={80} />
      <fieldset className="who-picker">
        <legend>Who&apos;s it for?</legend>
        <button type="button" className={`who-pick everyone${forId === null ? " is-on" : ""}`} aria-pressed={forId === null} onClick={() => setForId(null)}>
          <span className="everyone-badge" aria-hidden="true">🎁</span>
          Anyone
        </button>
        {members.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`who-pick${forId === m.id ? " is-on" : ""}`}
            style={{ ["--c" as string]: m.colour }}
            aria-pressed={forId === m.id}
            onClick={() => { setForId(m.id); suggestion(m); }}
          >
            <Avatar member={m} size={40} photoUrl={photos[m.id]} />
            {m.name}
          </button>
        ))}
      </fieldset>
      <label className="field">
        <span>Date (optional)</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <div className="sheet-actions">
        {list && (
          <button type="button" className="btn btn-danger" onClick={() => confirm(`Delete “${list.name}” and all its ideas?`) && onDelete()}>
            Delete wishlist
          </button>
        )}
        <span className="spacer" />
        <button className="btn btn-primary btn-big" disabled={!name.trim()}>{list ? "Save" : "Make wishlist"}</button>
      </div>
    </form>
  );
}
