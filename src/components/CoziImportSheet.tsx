"use client";

import { useState } from "react";
import { FeatureSheet } from "./FeatureSheet";

type Summary = {
  total: number;
  toImport: number;
  duplicates: number;
  repeating: number;
  skippedOld: number;
  simplified: number;
  imported?: number;
  sample: { title: string; starts_at: string; all_day: boolean; repeats: boolean; who: string[] }[];
};

// One-time move from Cozi: paste the shared calendar link (or pick a .ics file), check, then import.
export function CoziImportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [url, setUrl] = useState("");
  const [fileText, setFileText] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setSummary(null);
    setDone(null);
    setError(null);
  }

  async function send(commit: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/import/ics", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(fileText ? { text: fileText, commit } : { url, commit }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "That didn't work.");
      else if (commit) setDone(data.imported ?? 0);
      else setSummary(data);
    } catch {
      setError("That didn't work. Check the connection and try again.");
    }
    setBusy(false);
  }

  const when = (s: Summary["sample"][number]) =>
    new Date(s.starts_at).toLocaleString("en-GB", s.all_day ? { weekday: "short", day: "numeric", month: "short" } : { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <FeatureSheet open={open} title="Bring events over from Cozi" onClose={() => { reset(); onClose(); }}>
      {done !== null ? (
        <>
          <p className="fx-big">{done === 0 ? "Nothing new to add." : `Added ${done} ${done === 1 ? "event" : "events"} to the planner.`}</p>
          <p className="sheet-hint">They&apos;re on the calendar now. You can run this again later; events already here are skipped.</p>
          <div className="sheet-actions">
            <span className="spacer" />
            <button type="button" className="btn btn-primary btn-big" onClick={() => { reset(); setUrl(""); setFileText(null); setFileName(null); }}>Done</button>
          </div>
        </>
      ) : summary ? (
        <>
          <p className="fx-big">
            {summary.toImport === 0 ? "Everything in that calendar is already in the planner." : `${summary.toImport} ${summary.toImport === 1 ? "event" : "events"} to add`}
          </p>
          <ul className="fx-facts">
            {summary.duplicates > 0 && <li>{summary.duplicates} already in the planner, so they&apos;ll be skipped</li>}
            {summary.repeating > 0 && <li>{summary.repeating} of them repeat</li>}
            {summary.simplified > 0 && <li>{summary.simplified} use a repeat the planner can&apos;t store, so their dates are added one by one (or just the first date)</li>}
            {summary.skippedOld > 0 && <li>{summary.skippedOld} finished over a year ago and won&apos;t be added</li>}
          </ul>
          {summary.sample.length > 0 && (
            <ul className="fx-rows fx-sample">
              {summary.sample.map((s, i) => (
                <li key={i} className="fx-row">
                  <span className="fx-row-text">
                    <strong>{s.title}</strong>
                    <span className="fx-sub">{when(s)}{s.repeats ? " · repeats" : ""}{s.who.length ? ` · ${s.who.join(", ")}` : ""}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {error && <p className="login-error" role="alert">{error}</p>}
          <div className="sheet-actions">
            <button type="button" className="btn btn-quiet" onClick={reset}>Back</button>
            <span className="spacer" />
            {summary.toImport > 0 && (
              <button type="button" className="btn btn-primary btn-big" disabled={busy} onClick={() => send(true)}>
                {busy ? "Adding…" : `Add ${summary.toImport} ${summary.toImport === 1 ? "event" : "events"}`}
              </button>
            )}
          </div>
        </>
      ) : (
        <form className="fx-stack" onSubmit={(e) => { e.preventDefault(); void send(false); }}>
          <ol className="fx-steps">
            <li>Open Cozi on the web (cozi.com) and sign in.</li>
            <li>Go to <strong>Settings</strong> → <strong>Shared Cozi calendars</strong> and copy the link for the whole family calendar.</li>
            <li>Paste it here and tap <strong>Check</strong>. Nothing is added until you say so.</li>
          </ol>
          <label className="field">
            <span>Calendar link</span>
            <input
              value={url}
              onChange={(e) => { setUrl(e.target.value); setFileText(null); setFileName(null); }}
              placeholder="https://rest.cozi.com/…/feed.ics"
              inputMode="url"
              autoComplete="off"
            />
          </label>
          <label className="fx-file">
            <input
              type="file"
              accept=".ics,text/calendar"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setFileText(await f.text());
                setFileName(f.name);
                setUrl("");
              }}
            />
            <span className="btn btn-quiet btn-left">{fileName ? `Using ${fileName}` : "Or choose a calendar file (.ics)"}</span>
          </label>
          <p className="sheet-hint">Names at the start of a Cozi event, like “Millie: Swimming”, are matched to the family.</p>
          {error && <p className="login-error" role="alert">{error}</p>}
          <div className="sheet-actions">
            <span className="spacer" />
            <button className="btn btn-primary btn-big" disabled={busy || (!url.trim() && !fileText)}>{busy ? "Checking…" : "Check"}</button>
          </div>
        </form>
      )}
    </FeatureSheet>
  );
}
