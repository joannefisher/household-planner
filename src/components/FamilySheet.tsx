"use client";

import { useEffect, useRef, useState } from "react";
import { avatarUri, COLOURS, parseAvatar, randomSeeds, STYLES, type StyleKey } from "@/lib/avatars";
import type { Member } from "@/lib/types";
import { Avatar } from "./Avatar";

type Props = {
  open: boolean;
  members: Member[];
  photos: Record<string, string>;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<Member>) => Promise<void>;
  onUpload: (m: Member, f: File) => Promise<void>;
  onRemovePhoto: (m: Member) => Promise<void>;
  onSignOut: () => void;
  extra?: React.ReactNode;
};

export function FamilySheet({ open, members, photos, onClose, onUpdate, onUpload, onRemovePhoto, onSignOut, extra }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);

  const member = members.find((m) => m.id === selected) ?? members[0];

  return (
    <dialog ref={dialog} className="sheet family-sheet" onClose={onClose}>
      {open && member && (
        <div className="sheet-form">
          <div className="sheet-top">
            <h2 className="sheet-title">The family</h2>
            <button type="button" className="icon-btn" onClick={() => dialog.current?.close()} aria-label="Close">✕</button>
          </div>

          <div className="family-tabs" role="tablist">
            {members.map((m) => (
              <button
                key={m.id}
                role="tab"
                aria-selected={m.id === member.id}
                className={`family-tab${m.id === member.id ? " is-on" : ""}`}
                style={{ ["--c" as string]: m.colour }}
                onClick={() => setSelected(m.id)}
              >
                <Avatar member={m} size={56} photoUrl={photos[m.id]} />
                {m.name}
              </button>
            ))}
          </div>

          <MemberEditor
            key={member.id}
            member={member}
            photo={photos[member.id]}
            onUpdate={onUpdate}
            onUpload={onUpload}
            onRemovePhoto={onRemovePhoto}
          />

          {extra}

          <div className="sheet-actions">
            <button type="button" className="btn btn-quiet btn-left" onClick={onSignOut}>Sign out of this device</button>
          </div>
          <p className="credits">
            Characters: {Object.values(STYLES).map((s) => s.credit).join("; ")}. Made with DiceBear.
          </p>
        </div>
      )}
    </dialog>
  );
}

function MemberEditor({ member, photo, onUpdate, onUpload, onRemovePhoto }: { member: Member; photo?: string } & Pick<Props, "onUpdate" | "onUpload" | "onRemovePhoto">) {
  const current = parseAvatar(member.avatar, member.name);
  const [style, setStyle] = useState<StyleKey>(current.style);
  const [seeds, setSeeds] = useState(() => [current.seed, ...randomSeeds(9)]);
  const [name, setName] = useState(member.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  async function choosePhoto(f: File | undefined) {
    if (!f) return;
    setBusy(true);
    setError(null);
    try {
      await onUpload(member, f);
    } catch {
      setError("That photo didn't upload. Try a different picture.");
    }
    setBusy(false);
  }

  return (
    <div className="member-editor">
      <div className="me-hero" style={{ ["--c" as string]: member.colour }}>
        <Avatar member={member} size={112} photoUrl={photo} />
        <div className="me-hero-side">
          <label className="field">
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== member.name && onUpdate(member.id, { name: name.trim() })} />
          </label>
          <div className="photo-actions">
            <input ref={file} type="file" accept="image/*" hidden onChange={(e) => choosePhoto(e.target.files?.[0])} />
            <button type="button" className="btn btn-soft" disabled={busy} onClick={() => file.current?.click()}>
              {busy ? "Uploading…" : photo ? "Change photo" : "Use a photo"}
            </button>
            {photo && (
              <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => onRemovePhoto(member)}>
                Use character
              </button>
            )}
          </div>
          {error && <p className="login-error" role="alert">{error}</p>}
        </div>
      </div>

      <h3 className="me-label">Colour</h3>
      <div className="swatches" role="radiogroup" aria-label="Colour">
        {COLOURS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={member.colour === c}
            aria-label={c}
            className={`swatch${member.colour === c ? " is-on" : ""}`}
            style={{ background: c }}
            onClick={() => onUpdate(member.id, { colour: c })}
          />
        ))}
      </div>

      <h3 className="me-label">Character{photo ? " (shown when there's no photo)" : ""}</h3>
      <div className="style-tabs" role="tablist">
        {(Object.keys(STYLES) as StyleKey[]).map((k) => (
          <button key={k} role="tab" aria-selected={style === k} className={`style-tab${style === k ? " is-on" : ""}`} onClick={() => setStyle(k)}>
            {STYLES[k].label}
          </button>
        ))}
      </div>
      <div className="characters">
        {seeds.map((seed) => {
          const value = `${style}:${seed}`;
          const on = member.avatar === value;
          return (
            <button
              key={seed}
              type="button"
              className={`character${on ? " is-on" : ""}`}
              style={{ ["--c" as string]: member.colour }}
              aria-pressed={on}
              aria-label={`Character ${seed}`}
              onClick={() => onUpdate(member.id, { avatar: value })}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={avatarUri(value, seed)} alt="" />
            </button>
          );
        })}
        <button type="button" className="character shuffle" onClick={() => setSeeds([current.seed, ...randomSeeds(9)])}>
          Shuffle
        </button>
      </div>
    </div>
  );
}
