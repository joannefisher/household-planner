import { createClient } from "@supabase/supabase-js";

// For routes used without signing in (calendar feeds, Siri). It can only call the
// database functions that check a secret token themselves.
export function getAnonSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
