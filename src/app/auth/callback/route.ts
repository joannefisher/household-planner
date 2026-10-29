import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

// Where links in Supabase emails land: email confirmation and password reset.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") === "/reset" ? "/reset" : "/";

  if (code) {
    const supabase = await getServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }

  // The email address is confirmed by the time the link arrives here, even if this
  // browser can't finish signing in (e.g. the link opened outside the Home Screen app).
  const notice = next === "/reset" ? "reset" : "confirmed";
  return NextResponse.redirect(new URL(`/login?notice=${notice}`, url.origin));
}
