"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import type { Member } from "@/lib/types";
import { copyText, FeatureSheet } from "./FeatureSheet";

type TokenRow = { id: string; token: string; last_used_at: string | null };

// Your personal Siri key, and how to build the two Apple Shortcuts that use it.
export function SiriSheet({ open, onClose, householdId, me }: { open: boolean; onClose: () => void; householdId: string; me: Member }) {
  const [row, setRow] = useState<TokenRow | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await getSupabase().from("api_tokens").select("id,token,last_used_at").eq("member_id", me.id).order("created_at", { ascending: false }).limit(1);
    setRow(((data ?? [])[0] as TokenRow) ?? null);
    setLoaded(true);
  }, [me.id]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function make(replace: boolean) {
    setBusy(true);
    setError(null);
    const sb = getSupabase();
    if (replace) await sb.from("api_tokens").delete().eq("member_id", me.id);
    const { error } = await sb.from("api_tokens").insert({ household_id: householdId, member_id: me.id });
    if (error) setError("That didn't work. Check the connection and try again.");
    await load();
    setBusy(false);
  }

  async function copy(text: string, key: string) {
    if (await copyText(text)) {
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 2500);
    }
  }

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const addUrl = `${origin}/api/siri/add`;
  const dinnerUrl = `${origin}/api/siri/dinner`;
  const header = row ? `Bearer ${row.token}` : "";

  const Copy = ({ text, k, label }: { text: string; k: string; label: string }) => (
    <span className="siri-copy">
      <code>{text}</code>
      <button type="button" className="btn btn-soft btn-small" onClick={() => copy(text, k)}>{copied === k ? "Copied" : label}</button>
    </span>
  );

  return (
    <FeatureSheet open={open} title="Siri shortcuts" onClose={onClose}>
      <p className="sheet-hint">
        Say “Hey Siri, add to shopping” then the items, or “Hey Siri, what&apos;s for dinner”. You build each one once in the Shortcuts app on your iPhone, using your own key.
      </p>

      {!loaded ? (
        <p className="fx-empty">Loading…</p>
      ) : !row ? (
        <button type="button" className="btn btn-primary btn-big" disabled={busy} onClick={() => make(false)}>{busy ? "Making…" : "Make my Siri key"}</button>
      ) : (
        <div className="fx-row">
          <strong>Your key, {me.name}</strong>
          <Copy text={header} k="header" label="Copy" />
          <span className="fx-sub">
            {row.last_used_at ? `Last used ${new Date(row.last_used_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}.` : "Not used yet."} Keep it to yourself: it can add to the list and read dinners.
          </span>
          <button type="button" className="btn btn-quiet btn-left" disabled={busy} onClick={() => confirm("Make a new key? Shortcuts using the old one will stop working until you paste the new one in.") && make(true)}>
            Make a new key
          </button>
        </div>
      )}
      {error && <p className="login-error" role="alert">{error}</p>}

      {row && (
        <>
          <h3 className="me-label">1. “Add to shopping”</h3>
          <ol className="fx-steps">
            <li>Open the <strong>Shortcuts</strong> app, tap <strong>+</strong>, and name the shortcut <strong>Add to shopping</strong>. That name is what you say to Siri.</li>
            <li>Add the action <strong>Dictate Text</strong>.</li>
            <li>Add <strong>Get Contents of URL</strong> and paste this as the URL: <Copy text={addUrl} k="add" label="Copy link" /></li>
            <li>Tap the arrow on that action. Set <strong>Method</strong> to <strong>POST</strong>.</li>
            <li>Under <strong>Headers</strong>, add one. Key: <code>Authorization</code>. Value: your key from above (starting “Bearer”).</li>
            <li>Under <strong>Request Body</strong>, choose <strong>JSON</strong>, add a <strong>Text</strong> field with the key <code>text</code>, and for its value pick <strong>Dictated Text</strong>.</li>
            <li>Add <strong>Speak Text</strong>, set to <strong>Contents of URL</strong>, so Siri says what was added.</li>
            <li>Try it: “Hey Siri, add to shopping”, then “eggs, bread and bin bags”.</li>
          </ol>

          <h3 className="me-label">2. “What&apos;s for dinner”</h3>
          <ol className="fx-steps">
            <li>Make another shortcut named <strong>What&apos;s for dinner</strong>.</li>
            <li>Add <strong>Get Contents of URL</strong> with this URL: <Copy text={dinnerUrl} k="dinner" label="Copy link" /></li>
            <li>Tap the arrow. Leave <strong>Method</strong> as <strong>GET</strong> and add the same <strong>Authorization</strong> header with your key.</li>
            <li>Add <strong>Speak Text</strong> with <strong>Contents of URL</strong>.</li>
            <li>For tomorrow, make a copy named “Dinner tomorrow” and add <code>?day=tomorrow</code> to the end of the link.</li>
          </ol>
          <p className="sheet-hint">Each grown-up makes their own key on their own phone, so the list shows who added what.</p>
        </>
      )}
    </FeatureSheet>
  );
}
