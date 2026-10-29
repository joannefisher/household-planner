"use client";

import { useMemo, useRef, useState } from "react";
import { AISLES, formatQuantity } from "@/lib/parse";
import type { Member, ShoppingItem } from "@/lib/types";
import type { useShoppingList } from "@/lib/useShoppingList";

type List = ReturnType<typeof useShoppingList>;

export function ShoppingList({ list, members, addedBy }: { list: List; members: Member[]; addedBy: string | null }) {
  const [text, setText] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const [editing, setEditing] = useState<ShoppingItem | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  const { toBuy, trolley, usuals } = useMemo(() => {
    const toBuy = list.items.filter((i) => !i.checked);
    const trolley = list.items.filter((i) => i.checked && i.checked_at).sort((a, b) => a.name.localeCompare(b.name));
    const usuals = list.items.filter((i) => i.checked && !i.checked_at && i.usual).sort((a, b) => a.name.localeCompare(b.name));
    return { toBuy, trolley, usuals };
  }, [list.items]);

  const groups = useMemo(
    () =>
      AISLES.map((aisle) => ({
        aisle,
        items: toBuy.filter((i) => (i.aisle ?? "Other") === aisle).sort((a, b) => a.name.localeCompare(b.name)),
      })).filter((g) => g.items.length),
    [toBuy],
  );

  const colourOf = (id: string | null) => members.find((m) => m.id === id)?.colour;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    const n = list.addText(text, addedBy);
    setFlash(n === 0 ? "Already on the list" : null);
    setText("");
  }

  function openEdit(item: ShoppingItem) {
    setEditing(item);
    dialog.current?.showModal();
  }

  return (
    <section className="list" aria-label="Shopping list">
      <div className="list-head">
        <h2 className="panel-title">Shopping</h2>
        <span className="list-count">{toBuy.length === 0 ? "Nothing to buy" : `${toBuy.length} to buy`}</span>
      </div>

      <form className="add-bar" onSubmit={submit}>
        <input
          aria-label="Add items"
          placeholder="Milk, bread and 2 tins of tomatoes"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setFlash(null);
          }}
          enterKeyHint="done"
          autoComplete="off"
        />
        <button className="btn btn-primary" disabled={!text.trim()}>Add</button>
      </form>
      {flash && <p className="flash" role="status">{flash}</p>}
      {(!list.online || list.pending > 0) && (
        <p className="sync-note" role="status">
          {list.online ? "Saving…" : `No signal. ${list.pending || "Changes"} ${list.pending === 1 ? "change" : "changes"} will save when you're back online.`}
        </p>
      )}

      {usuals.length > 0 && (
        <div className="usuals" aria-label="Usuals">
          {usuals.map((u) => (
            <button key={u.id} className="chip" onClick={() => list.toggle(u)}>
              + {u.name}
            </button>
          ))}
        </div>
      )}

      <div className="list-scroll">
        {groups.length === 0 && trolley.length === 0 && (
          <p className="empty">The list is empty. Type above, separating items with commas or “and”.</p>
        )}
        {groups.map((g) => (
          <div key={g.aisle} className="aisle">
            <h3 className="aisle-name">{g.aisle}</h3>
            <ul>
              {g.items.map((i) => (
                <Row key={i.id} item={i} colour={colourOf(i.added_by)} onToggle={() => list.toggle(i)} onEdit={() => openEdit(i)} />
              ))}
            </ul>
          </div>
        ))}

        {trolley.length > 0 && (
          <div className="aisle trolley">
            <div className="trolley-head">
              <h3 className="aisle-name">In the trolley</h3>
              <button className="btn btn-quiet btn-small" onClick={list.clearTicked}>Clear ticked</button>
            </div>
            <ul>
              {trolley.map((i) => (
                <Row key={i.id} item={i} colour={colourOf(i.added_by)} onToggle={() => list.toggle(i)} onEdit={() => openEdit(i)} />
              ))}
            </ul>
          </div>
        )}
      </div>

      <dialog ref={dialog} className="sheet" onClose={() => setEditing(null)}>
        {editing && (
          <EditItem
            key={editing.id}
            item={editing}
            onSave={(patch) => {
              list.update(editing.id, patch);
              dialog.current?.close();
            }}
            onDelete={() => {
              list.remove(editing.id);
              dialog.current?.close();
            }}
            onCancel={() => dialog.current?.close()}
          />
        )}
      </dialog>
    </section>
  );
}

function Row({ item, colour, onToggle, onEdit }: { item: ShoppingItem; colour?: string; onToggle: () => void; onEdit: () => void }) {
  const qty = formatQuantity(item);
  return (
    <li className={`item${item.checked ? " is-checked" : ""}`}>
      <button className="item-main" onClick={onToggle} aria-pressed={item.checked}>
        <span className="tick" aria-hidden="true" style={{ borderColor: colour }}>
          {item.checked ? "✓" : ""}
        </span>
        <span className="item-name">{item.name}</span>
        {qty && <span className="item-qty">{qty}</span>}
      </button>
      <button className="item-edit" onClick={onEdit} aria-label={`Edit ${item.name}`}>
        Edit
      </button>
    </li>
  );
}

function EditItem({
  item,
  onSave,
  onDelete,
  onCancel,
}: {
  item: ShoppingItem;
  onSave: (p: Partial<ShoppingItem>) => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [qty, setQty] = useState(item.quantity?.toString() ?? "");
  const [unit, setUnit] = useState(item.unit ?? "");
  const [aisle, setAisle] = useState(item.aisle ?? "Other");
  const [usual, setUsual] = useState(item.usual);

  return (
    <form
      className="sheet-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ name: name.trim() || item.name, quantity: qty ? Number(qty) : null, unit: unit.trim() || null, aisle, usual });
      }}
    >
      <h2 className="sheet-title">Edit item</h2>
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="sheet-row">
        <label>
          Quantity
          <input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^\d.]/g, ""))} />
        </label>
        <label>
          Unit
          <input value={unit} placeholder="tins, kg…" onChange={(e) => setUnit(e.target.value)} />
        </label>
      </div>
      <label>
        Aisle
        <select value={aisle} onChange={(e) => setAisle(e.target.value)}>
          {AISLES.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
      </label>
      <label className="check">
        <input type="checkbox" checked={usual} onChange={(e) => setUsual(e.target.checked)} />
        Keep as a usual, so it can be re-added with one tap
      </label>
      <div className="sheet-actions">
        <button type="button" className="btn btn-danger" onClick={onDelete}>Delete</button>
        <span className="spacer" />
        <button type="button" className="btn btn-quiet" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary">Save</button>
      </div>
    </form>
  );
}
