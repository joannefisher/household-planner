"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import type { Member } from "@/lib/types";
import { Avatar } from "./Avatar";
import { copyText, FeatureSheet } from "./FeatureSheet";

type FeedRow = { id: string; member_id: string | null; token: string };

// Links the iPhone Calendar app can subscribe to: the whole family, or one person plus family events.
export function CalendarFeedSheet({ open, onClose, householdId, members, photos }: { open: boolean; onClose: () => void; householdId: string; members: Member[]; photos: Record<string, string> }) {
  const [feeds, setFeeds] = useState<FeedRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await getSupabase().from("calendar_feeds").select("id,member_id,token").eq("household_id", householdId).order("created_at");
    setFeeds((data ?? []) as FeedRow[]);
  }, [householdId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const httpsLink = (t: string) => `${origin}/api/calendar/${t}`;
  const webcalLink = (t: string) => httpsLink(t).replace(/^https?:/, "webcal:");

  async function make(memberId: string | null, replace?: FeedRow) {
    const key = memberId ?? "all";
    setBusy(key);
    setError(null);
    const sb = getSupabase();
    if (replace) await sb.from("calendar_feeds").delete().eq("id", replace.id);
    const { error } = await sb.from("calendar_feeds").insert({ household_id: householdId, member_id: memberId });
    if (error) setError("That didn't work. Check the connection and try again.");
    await load();
    setBusy(null);
  }

  async function copy(t: string, key: string) {
    if (await copyText(httpsLink(t))) {
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 2500);
    }
  }

  const targets: { key: string; memberId: string | null; label: string; hint: string; member?: Member }[] = [
    { key: "all", memberId: null, label: "Whole family", hint: "Everything on the planner" },
    ...members.map((m) => ({ key: m.id, memberId: m.id, label: m.name, hint: `${m.name}'s events and family events`, member: m })),
  ];

  return (
    <FeatureSheet open={open} title="Calendar on your iPhone" onClose={onClose}>
      <p className="sheet-hint">
        Make a link, then add it to the Calendar app. The iPhone keeps it up to date by itself. Add and change events here in the planner; changes made in the Calendar app don&apos;t come back.
      </p>

      <ul className="fx-rows">
        {targets.map((t) => {
          const feed = feeds.find((f) => f.member_id === t.memberId);
          return (
            <li key={t.key} className="fx-row feed-row">
              <div className="fx-row-head">
                {t.member ? <Avatar member={t.member} size={40} photoUrl={photos[t.member.id]} /> : <span className="everyone-badge" aria-hidden="true">★</span>}
                <span className="fx-row-text">
                  <strong>{t.label}</strong>
                  <span className="fx-sub">{t.hint}</span>
                </span>
                {!feed && (
                  <button type="button" className="btn btn-soft" disabled={busy === t.key} onClick={() => make(t.memberId)}>
                    {busy === t.key ? "Making…" : "Make link"}
                  </button>
                )}
              </div>
              {feed && (
                <div className="feed-actions">
                  <a className="btn btn-primary" href={webcalLink(feed.token)}>Add to this iPhone</a>
                  <button type="button" className="btn btn-soft" onClick={() => copy(feed.token, t.key)}>{copied === t.key ? "Copied" : "Copy link"}</button>
                  <button
                    type="button"
                    className="btn btn-quiet"
                    disabled={busy === t.key}
                    onClick={() => confirm("Make a new link? The old link will stop working on any phone that uses it.") && make(t.memberId, feed)}
                  >
                    New link
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {error && <p className="login-error" role="alert">{error}</p>}

      <h3 className="me-label">Adding it by hand</h3>
      <ol className="fx-steps">
        <li>Tap <strong>Copy link</strong> for the person you want.</li>
        <li>Open the iPhone <strong>Settings</strong> app, then <strong>Calendar</strong> → <strong>Accounts</strong> → <strong>Add Account</strong> → <strong>Other</strong>.</li>
        <li>Tap <strong>Add Subscribed Calendar</strong>, paste the link, tap <strong>Next</strong>, then <strong>Save</strong>.</li>
        <li>To get changes sooner, go to <strong>Calendar</strong> → <strong>Accounts</strong> → <strong>Fetch New Data</strong> and choose every 15 minutes or hourly.</li>
      </ol>
      <p className="sheet-hint">Anyone with a link can see those events, so only share it with the family. If a link gets out, tap New link.</p>
    </FeatureSheet>
  );
}
