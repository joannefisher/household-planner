import { getServerSupabase } from "@/lib/supabase/server";

// The signed-in person's member row and household, for API routes that act as them (RLS applies).
export async function getSignedInMember() {
  const sb = await getServerSupabase();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return null;
  const { data: member } = await sb.from("members").select("id,name,household_id,role").eq("user_id", auth.user.id).maybeSingle();
  if (!member) return null;
  const { data: household } = await sb.from("households").select("id,name,timezone").eq("id", member.household_id).single();
  if (!household) return null;
  return { sb, member: member as { id: string; name: string; household_id: string; role: string }, household: household as { id: string; name: string; timezone: string } };
}

export function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}
