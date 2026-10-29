"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase/client";

export default function ResetPage() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await getSupabase().auth.updateUser({ password });
    setBusy(false);
    if (error) setError(error.message);
    else window.location.href = "/";
  }

  return (
    <main className="login">
      <div className="login-card">
        <h1 className="login-title">New password</h1>
        <p className="login-sub">Choose a new password for the planner.</p>
        <form onSubmit={submit} className="login-form">
          <label htmlFor="password">New password (at least 8 characters)</label>
          <input id="password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Save password"}</button>
        </form>
        {error && <p className="login-error" role="alert">{error}</p>}
      </div>
    </main>
  );
}
