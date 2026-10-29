"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await getSupabase().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
    if (error) {
      setError(
        error.message.includes("Database error")
          ? "That email isn't on the household list. Check the spelling, or ask Joanne to add it."
          : error.message,
      );
      return;
    }
    setStage("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await getSupabase().auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    setBusy(false);
    if (error) {
      setError("That code didn't work. Check the latest email, or send a new code.");
      return;
    }
    window.location.href = "/";
  }

  return (
    <main className="login">
      <div className="login-card">
        <h1 className="login-title">Fisher-Oakley</h1>
        <p className="login-sub">Sign in to the household planner.</p>

        {stage === "email" ? (
          <form onSubmit={sendCode} className="login-form">
            <label htmlFor="email">Your email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button className="btn btn-primary" disabled={busy}>
              {busy ? "Sending…" : "Email me a sign-in code"}
            </button>
          </form>
        ) : (
          <form onSubmit={verify} className="login-form">
            <label htmlFor="code">Code from the email sent to {email}</label>
            <input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6,8}"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="code-input"
            />
            <button className="btn btn-primary" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => setStage("email")}>
              Use a different email
            </button>
          </form>
        )}
        {error && <p className="login-error" role="alert">{error}</p>}
      </div>
    </main>
  );
}
