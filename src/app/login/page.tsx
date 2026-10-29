"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase/client";

type Mode = "signin" | "create" | "forgot";

const NOTICES: Record<string, string> = {
  confirmed: "Email confirmed. Sign in with your password.",
  reset: "That reset link didn't work here. Open the planner in Safari, request a new link, and open it on the same device.",
  link: "That link has expired or was already used. Sign in with your password.",
};

function LoginForm() {
  const params = useSearchParams();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(NOTICES[params.get("notice") ?? params.get("error") ?? ""] ?? null);

  function switchTo(m: Mode) {
    setMode(m);
    setError(null);
    setNotice(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const sb = getSupabase();
    const addr = email.trim();
    const callback = `${window.location.origin}/auth/callback`;

    if (mode === "signin") {
      const { error } = await sb.auth.signInWithPassword({ email: addr, password });
      setBusy(false);
      if (!error) {
        window.location.href = "/";
        return;
      }
      if (/not confirmed/i.test(error.message)) setError("Confirm your email first: open the link in the email we sent, then sign in here.");
      else if (/invalid login/i.test(error.message)) setError("That email and password don't match. If this is your first time, create your password instead.");
      else setError(error.message);
      return;
    }

    if (mode === "create") {
      const { data, error } = await sb.auth.signUp({ email: addr, password, options: { emailRedirectTo: callback } });
      setBusy(false);
      if (error) {
        if (/database error/i.test(error.message)) setError("That email isn't on the household list. Check the spelling.");
        else if (/already registered/i.test(error.message)) setError("You already have a password. Sign in instead.");
        else setError(error.message);
        return;
      }
      if (data.session) {
        window.location.href = "/";
        return;
      }
      setNotice(`Nearly done. Open the link in the email sent to ${addr}, then come back and sign in.`);
      setMode("signin");
      return;
    }

    const { error } = await sb.auth.resetPasswordForEmail(addr, { redirectTo: `${callback}?next=/reset` });
    setBusy(false);
    if (error) setError(error.message);
    else setNotice(`Reset link sent to ${addr}. Open it on this device.`);
  }

  return (
    <main className="login">
      <div className="login-card">
        <h1 className="login-title">Fisher-Oakley</h1>
        <p className="login-sub">
          {mode === "signin" && "Sign in to the household planner."}
          {mode === "create" && "First time here? Choose a password."}
          {mode === "forgot" && "We'll email you a link to set a new password."}
        </p>

        <form onSubmit={submit} className="login-form">
          <label htmlFor="email">Your email</label>
          <input id="email" type="email" autoComplete="username" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />

          {mode !== "forgot" && (
            <>
              <label htmlFor="password">{mode === "create" ? "New password (at least 8 characters)" : "Password"}</label>
              <input
                id="password"
                type="password"
                autoComplete={mode === "create" ? "new-password" : "current-password"}
                required
                minLength={mode === "create" ? 8 : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </>
          )}

          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : mode === "create" ? "Create password" : "Email me a reset link"}
          </button>
        </form>

        {notice && <p className="login-notice" role="status">{notice}</p>}
        {error && <p className="login-error" role="alert">{error}</p>}

        <div className="login-links">
          {mode !== "signin" && <button className="btn btn-quiet" onClick={() => switchTo("signin")}>Back to sign in</button>}
          {mode === "signin" && <button className="btn btn-quiet" onClick={() => switchTo("create")}>First time? Create your password</button>}
          {mode === "signin" && <button className="btn btn-quiet" onClick={() => switchTo("forgot")}>Forgot password</button>}
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
