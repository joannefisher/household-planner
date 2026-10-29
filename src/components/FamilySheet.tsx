"use client";

import { useEffect, useRef, useState } from "react";
import { avatarUri, COLOURS } from "@/lib/avatars";
import { ANIMALS } from "@/lib/animals";
import {
  DEFAULT_PORTRAIT, EYE_COLOURS, FAMILY_PORTRAITS, formatPortrait, HAIR_COLOURS, HAIR_STYLES, parsePortrait, SKIN_TONES, TOP_COLOURS,
  type HairStyle, type Portrait,
} from "@/lib/portrait";
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
  // Opens straight onto this person's character and photo
  initialMember?: string | null;
};

export function FamilySheet({ open, members, photos, onClose, onUpdate, onUpload, onRemovePhoto, onSignOut, extra, initialMember }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (initialMember) setSelected(initialMember);
      dialog.current?.showModal();
    } else dialog.current?.close();
  }, [open, initialMember]);

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
        </div>
      )}
    </dialog>
  );
}

function MemberEditor({ member, photo, onUpdate, onUpload, onRemovePhoto }: { member: Member; photo?: string } & Pick<Props, "onUpdate" | "onUpload" | "onRemovePhoto">) {
  const isAnimal = member.avatar?.startsWith("a:") ?? false;
  const [mode, setMode] = useState<"portrait" | "animal">(isAnimal ? "animal" : "portrait");
  const [portrait, setPortrait] = useState<Portrait>(() => parsePortrait(member.avatar) ?? FAMILY_PORTRAITS[member.name] ?? DEFAULT_PORTRAIT);
  const [name, setName] = useState(member.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  function changePortrait(patch: Partial<Portrait>) {
    const next = { ...portrait, ...patch };
    setPortrait(next);
    void onUpdate(member.id, { avatar: formatPortrait(next) });
  }

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

  const swatchRow = (label: string, colours: string[], value: string, key: keyof Portrait) => (
    <div className="pb-row">
      <span className="pb-label">{label}</span>
      <div className="swatches small" role="radiogroup" aria-label={label}>
        {colours.map((c) => (
          <button key={c} type="button" role="radio" aria-checked={value === c} aria-label={`${label} ${c}`} className={`swatch${value === c ? " is-on" : ""}`} style={{ background: `#${c}` }} onClick={() => changePortrait({ [key]: c } as Partial<Portrait>)} />
        ))}
      </div>
    </div>
  );

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
                Use drawing instead
              </button>
            )}
          </div>
          {error && <p className="login-error" role="alert">{error}</p>}
        </div>
      </div>

      <h3 className="me-label">Colour</h3>
      <div className="swatches" role="radiogroup" aria-label="Colour">
        {COLOURS.map((c) => (
          <button key={c} type="button" role="radio" aria-checked={member.colour === c} aria-label={c} className={`swatch${member.colour === c ? " is-on" : ""}`} style={{ background: c }} onClick={() => onUpdate(member.id, { colour: c })} />
        ))}
      </div>

      <h3 className="me-label">Picture{photo ? " (shown when there's no photo)" : ""}</h3>
      <div className="style-tabs" role="tablist">
        <button role="tab" aria-selected={mode === "portrait"} className={`style-tab${mode === "portrait" ? " is-on" : ""}`} onClick={() => { setMode("portrait"); changePortrait({}); }}>
          Portrait
        </button>
        <button role="tab" aria-selected={mode === "animal"} className={`style-tab${mode === "animal" ? " is-on" : ""}`} onClick={() => setMode("animal")}>
          Animals
        </button>
      </div>

      {mode === "portrait" ? (
        <div className="portrait-builder">
          <div className="pb-row">
            <span className="pb-label">Age</span>
            <div className="chips">
              {(["adult", "child", "baby"] as const).map((a) => (
                <button key={a} type="button" className={`chip-btn${portrait.age === a ? " is-on" : ""}`} onClick={() => changePortrait({ age: a, ...(a !== "adult" ? { beard: false } : {}) })}>
                  {a === "adult" ? "Grown-up" : a === "child" ? "Child" : "Baby"}
                </button>
              ))}
            </div>
          </div>
          <div className="pb-row">
            <span className="pb-label">Hair</span>
            <div className="chips">
              {(Object.keys(HAIR_STYLES) as HairStyle[]).map((h) => (
                <button key={h} type="button" className={`chip-btn${portrait.hair === h ? " is-on" : ""}`} onClick={() => changePortrait({ hair: h })}>
                  {HAIR_STYLES[h]}
                </button>
              ))}
            </div>
          </div>
          {swatchRow("Hair colour", HAIR_COLOURS, portrait.hc, "hc")}
          {swatchRow("Skin", SKIN_TONES, portrait.skin, "skin")}
          {swatchRow("Eyes", EYE_COLOURS, portrait.eyes, "eyes")}
          {swatchRow("Top", TOP_COLOURS, portrait.top, "top")}
          <div className="pb-row">
            <span className="pb-label">Extras</span>
            <div className="chips">
              <button type="button" className={`chip-btn${portrait.glasses ? " is-on" : ""}`} aria-pressed={portrait.glasses} onClick={() => changePortrait({ glasses: !portrait.glasses })}>Glasses</button>
              {portrait.age === "adult" && (
                <button type="button" className={`chip-btn${portrait.beard ? " is-on" : ""}`} aria-pressed={portrait.beard} onClick={() => changePortrait({ beard: !portrait.beard })}>Beard</button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="characters">
          {ANIMALS.map((a) => {
            const value = `a:${a}`;
            const on = member.avatar === value;
            return (
              <button key={a} type="button" className={`character${on ? " is-on" : ""}`} style={{ ["--c" as string]: member.colour }} aria-pressed={on} aria-label={a} onClick={() => onUpdate(member.id, { avatar: value })}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={avatarUri(value, member.name)} alt="" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
