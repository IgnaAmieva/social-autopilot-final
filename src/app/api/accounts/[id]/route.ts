import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

type Params = { params: Promise<{ id: string }> };

// GET /api/accounts/[id]
// Returns full account config
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("accounts")
    .select(`
      id,
      username,
      enabled,
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
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  return NextResponse.json({ account: data });
}

// PUT /api/accounts/[id]
// Updates editorial config + Typefully credentials for one account.
export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();

  const ALLOWED_FIELDS = [
    "typefully_api_key",
    "typefully_social_set_id",
    "enabled",
    "niche",
    "subniche",
    "system_prompt",
    "tone",
    "language",
    "evergreen_only",
    "tweets_per_day_default",
  ];

  const updates: Record<string, unknown> = {};

  for (const field of ALLOWED_FIELDS) {
    if (field in body) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("accounts")
    .update(updates)
    .eq("id", id)
    .select(`
      id,
      username,
      enabled,
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
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ account: data });
}