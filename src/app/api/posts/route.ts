import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  const { data, error } = await supabase
    .from("posts")
    .select("*, accounts(username, display_name)")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ posts: data });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { account_id, content, scheduled_at } = body;

  if (!account_id || !content) {
    return NextResponse.json(
      { error: "account_id y content son requeridos" },
      { status: 400 }
    );
  }

  if (content.length > 280) {
    return NextResponse.json(
      { error: "El tweet no puede superar los 280 caracteres" },
      { status: 400 }
    );
  }

  const status = scheduled_at ? "scheduled" : "draft";

  const { data, error } = await supabase
    .from("posts")
    .insert({
      account_id,
      content,
      status,
      scheduled_at: scheduled_at || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ post: data }, { status: 201 });
}