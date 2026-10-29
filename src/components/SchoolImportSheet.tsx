"use client";

import { useState } from "react";
import { unzipSync, strFromU8 } from "fflate";
import { addDays, fmt, fromIsoDay, isoDay } from "@/lib/dates";
import { formatRule } from "@/lib/recurrence";
import { getSupabase } from "@/lib/supabase/client";
import type { Member } from "@/lib/types";
import type { SchoolCalendar } from "@/app/api/school/read/route";
import { Avatar } from "./Avatar";
import { FeatureSheet } from "./FeatureSheet";

type Payload = { kind: "pdf" | "image" | "text"; mediaType?: string; data: string };

const toBase64 = (buf: ArrayBuffer) => {
  let s = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

// Turns the chosen file into something Claude can read, keeping uploads small
async function readFile(f: File): Promise<Payload> {
  const name = f.name.toLowerCase();
  if (f.type === "application/pdf" || name.endsWith(".pdf")) {
    if (f.size > 3_000_000) throw new Error("That PDF is too big (over 3 MB). Try a smaller copy, or a photo of each page.");
    return { kind: "pdf", data: toBase64(await f.arrayBuffer()) };
  }
  if (f.type.startsWith("image/") || /\.(jpe?g|png|heic|webp)$/.test(name)) {
    const img = await createImageBitmap(f);
    const scale = Math.min(1, 1800 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL("image/jpeg", 0.85);
    return { kind: "image", mediaType: "image/jpeg", data: url.split(",")[1] };
  }
  if (name.endsWith(".docx")) {
    const files = unzipSync(new Uint8Array(await f.arrayBuffer()));
    const xml = files["word/document.xml"];
    if (!xml) throw new Error("That Word file couldn't be opened.");
    const text = strFromU8(xml)
      .replace(/<\/w:p>/g, "\n")
      .replace(/<w:tab\/>/g, "\t")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
    return { kind: "text", data: text };
  }
  if (name.endsWith(".doc")) throw new Error("Old .doc files can't be read. Save it as a PDF or .docx first.");
  return { kind: "text", data: await f.text() };
}

const range = (a: string, b: string) => {
  const out: string[] = [];
  for (let d = fromIsoDay(a); isoDay(d) <= b; d = addDays(d, 1)) out.push(isoDay(d));
  return out;
};
const isWeekday = (iso: string) => {
  const d = fromIsoDay(iso).getDay();
  return d >= 1 && d <= 5;
};
const short = (iso: string) => fmt(fromIsoDay(iso), { weekday: "short", day: "numeric", month: "short" });

type Row = { key: string; group: "term" | "holiday" | "noSchool" | "event"; label: string; sub: string };

export function SchoolImportSheet({ open, onClose, householdId, members, photos }: { open: boolean; onClose: () => void; householdId: string; members: Member[]; photos: Record<string, string> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cal, setCal] = useState<SchoolCalendar | null>(null);
  const [who, setWho] = useState<string[]>(() => members.filter((m) => m.role === "child").slice(0, 1).map((m) => m.id));
  const [startTime, setStartTime] = useState("08:20");
  const [endTime, setEndTime] = useState("15:10");
  const [skip, setSkip] = useState<string[]>([]);
  const [done, setDone] = useState<string | null>(null);

  function reset() {
    setCal(null);
    setError(null);
    setSkip([]);
    setDone(null);
  }

  async function choose(f: File | undefined) {
    if (!f) return;
    reset();
    setBusy(true);
    try {
      const payload = await readFile(f);
      const res = await fetch("/api/school/read", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? "Couldn't read that file.");
      else setCal(data.calendar);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Couldn't read that file.");
    }
    setBusy(false);
  }

  const rows: Row[] = cal
    ? [
        ...cal.terms.map((t, i) => ({ key: `t${i}`, group: "term" as const, label: `${t.name}: school days`, sub: `${short(t.start)} – ${short(t.end)}, weekdays ${startTime}–${endTime}` })),
        ...cal.holidays.map((h, i) => ({ key: `h${i}`, group: "holiday" as const, label: h.title, sub: `${short(h.start)} – ${short(h.end)}` })),
        ...cal.noSchool.map((n, i) => ({ key: `n${i}`, group: "noSchool" as const, label: `${n.title} (no school)`, sub: n.start === n.end ? short(n.start) : `${short(n.start)} – ${short(n.end)}` })),
        ...cal.events.map((e, i) => ({ key: `e${i}`, group: "event" as const, label: e.title, sub: `${short(e.date)}${e.start ? `, ${e.start}${e.end ? `–${e.end}` : ""}` : e.end ? `, finishes ${e.end}` : ""}` })),
      ]
    : [];
  const chosen = rows.filter((r) => !skip.includes(r.key));

  async function addAll() {
    if (!cal) return;
    setBusy(true);
    setError(null);
    const sb = getSupabase();
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const off = new Set(cal.noSchool.flatMap((n) => range(n.start, n.end)));
    type NewEvent = { id: string; household_id: string; title: string; starts_at: string; ends_at: string; all_day: boolean; rrule: string | null; notes: string | null };
    const events: NewEvent[] = [];
    const add = (e: Omit<NewEvent, "id" | "household_id">) => events.push({ id: crypto.randomUUID(), household_id: householdId, ...e });
    const school = cal.school ? ` (${cal.school})` : "";

    cal.terms.forEach((t, i) => {
      if (skip.includes(`t${i}`)) return;
      const first = range(t.start, t.end).find((d) => isWeekday(d) && !off.has(d));
      if (!first) return;
      const ex = range(t.start, t.end).filter((d) => isWeekday(d) && off.has(d));
      add({
        title: "School",
        starts_at: fromIsoDay(first, sh, sm).toISOString(),
        ends_at: fromIsoDay(first, eh, em).toISOString(),
        all_day: false,
        rrule: formatRule({ freq: "WEEKLY", interval: 1, byDay: [0, 1, 2, 3, 4], until: t.end, count: null, exDates: ex }),
        notes: `${t.name}${school}`,
      });
    });
    const allDay = (title: string, s: string, e: string, notes: string | null) =>
      add({ title, starts_at: fromIsoDay(s).toISOString(), ends_at: fromIsoDay(e).toISOString(), all_day: true, rrule: null, notes });
    cal.holidays.forEach((h, i) => !skip.includes(`h${i}`) && allDay(`${h.title} (no school)`, h.start, h.end, cal.school));
    cal.noSchool.forEach((n, i) => !skip.includes(`n${i}`) && allDay(`${n.title} (no school)`, n.start, n.end, cal.school));
    cal.events.forEach((e, i) => {
      if (skip.includes(`e${i}`)) return;
      if (e.start) {
        const [a, b] = e.start.split(":").map(Number);
        const [c, d] = (e.end ?? "").split(":").map(Number);
        const s = fromIsoDay(e.date, a, b);
        add({ title: e.title, starts_at: s.toISOString(), ends_at: e.end ? fromIsoDay(e.date, c, d).toISOString() : new Date(s.getTime() + 3600e3).toISOString(), all_day: false, rrule: null, notes: cal.school });
      } else allDay(e.end ? `${e.title} (finishes ${e.end})` : e.title, e.date, e.endDate ?? e.date, cal.school);
    });

    // Skip anything already on the calendar with the same name and start
    const { data: existing } = await sb.from("events").select("title,starts_at").eq("household_id", householdId).in("title", [...new Set(events.map((e) => e.title))]);
    const seen = new Set((existing ?? []).map((e) => `${e.title}|${new Date(e.starts_at).getTime()}`));
    const fresh = events.filter((e) => !seen.has(`${e.title}|${new Date(e.starts_at).getTime()}`));

    if (fresh.length) {
      const { error } = await sb.from("events").insert(fresh);
      if (error) {
        setError("Those didn't save. Check the connection and try again.");
        setBusy(false);
        return;
      }
      if (who.length && who.length < members.length) {
        await sb.from("event_members").insert(fresh.flatMap((e) => who.map((member_id) => ({ event_id: e.id, member_id }))));
      }
    }
    setBusy(false);
    setDone(`Added ${fresh.length} ${fresh.length === 1 ? "thing" : "things"} to the calendar${events.length > fresh.length ? ` (${events.length - fresh.length} were already there)` : ""}.`);
    setCal(null);
  }

  return (
    <FeatureSheet open={open} title="School calendar" onClose={() => { reset(); onClose(); }}>
      <div className="fx-stack">
        {!cal && (
          <>
            <p className="sheet-hint">Upload the school&apos;s term dates or events calendar: a PDF, a Word document or a photo. Claude reads it, then you check everything before it goes on the calendar.</p>
            <label className="btn btn-primary btn-big fx-file">
              {busy ? "Reading it…" : "Choose the school calendar"}
              <input type="file" accept="application/pdf,.pdf,.docx,.txt,image/*" hidden disabled={busy} onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
          </>
        )}
        {error && <p className="fx-result" role="alert">{error}</p>}
        {done && <p className="fx-result" role="status">{done}</p>}

        {cal && (
          <>
            <h3 className="fx-big">{cal.school ?? "Your school calendar"}</h3>
            <fieldset className="who-picker">
              <legend>Who goes to this school?</legend>
              {members.map((m) => {
                const on = who.includes(m.id);
                return (
                  <button key={m.id} type="button" className={`who-pick${on ? " is-on" : ""}`} style={{ ["--c" as string]: m.colour }} aria-pressed={on} onClick={() => setWho((w) => (on ? w.filter((x) => x !== m.id) : [...w, m.id]))}>
                    <Avatar member={m} size={40} photoUrl={photos[m.id]} />
                    {m.name}
                  </button>
                );
              })}
            </fieldset>
            <div className="field-row">
              <label className="field">
                <span>School starts</span>
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </label>
              <label className="field">
                <span>School finishes</span>
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </label>
            </div>
            {rows.length === 0 ? (
              <p className="fx-empty">No dates were found in that file.</p>
            ) : (
              <>
                {(["term", "holiday", "noSchool", "event"] as const).map((g) => {
                  const group = rows.filter((r) => r.group === g);
                  if (!group.length) return null;
                  return (
                    <div key={g} className="school-group">
                      <h4 className="me-label">{g === "term" ? "Term time" : g === "holiday" ? "Holidays" : g === "noSchool" ? "Days off in term" : "School events"}</h4>
                      <ul className="fx-rows">
                        {group.map((r) => {
                          const on = !skip.includes(r.key);
                          return (
                            <li key={r.key}>
                              <label className={`fx-row school-row${on ? "" : " is-off"}`}>
                                <input type="checkbox" checked={on} onChange={() => setSkip((s) => (on ? [...s, r.key] : s.filter((x) => x !== r.key)))} />
                                <span className="fx-row-text">
                                  <strong>{r.label}</strong>
                                  <span className="fx-sub">{r.sub}</span>
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
                <p className="sheet-hint">Term time becomes a repeating &quot;School&quot; event on weekdays, skipping the days off. Check the dates against the original; Claude can misread things.</p>
              </>
            )}
            <div className="sheet-actions">
              <button type="button" className="btn btn-quiet" onClick={reset}>Choose a different file</button>
              <span className="spacer" />
              <button type="button" className="btn btn-primary btn-big" disabled={busy || chosen.length === 0} onClick={addAll}>
                {busy ? "Adding…" : `Add ${chosen.length} to the calendar`}
              </button>
            </div>
          </>
        )}
      </div>
    </FeatureSheet>
  );
}
