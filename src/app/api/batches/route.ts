import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

// GET /api/batches?accountId=xxx&limit=20
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);

  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("content_batches")
    .select(
      `id, account_id, topic, start_date, days, tweets_per_day,
       total_tweets, status, error_message, created_at,
       accounts(username)`
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (accountId) {
    query = query.eq("account_id", accountId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ batches: data });
}
