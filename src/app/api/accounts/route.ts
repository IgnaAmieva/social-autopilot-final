import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

// Returns all accounts with their editorial config for the dashboard selector.
// Sensitive fields (access_token, typefully_api_key) are excluded.
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("accounts")
      .select(`
  id,
  username,
  typefully_social_set_id,
  typefully_api_key,
  niche,
  subniche,
  system_prompt,
  tone,
  language,
  evergreen_only,
  tweets_per_day_default,
  created_at
`)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ accounts: data });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
