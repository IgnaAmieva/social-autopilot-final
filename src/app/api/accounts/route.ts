import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase URL or ANON_KEY not configured");
}

const supabase = createClient(
  supabaseUrl || "",
  supabaseAnonKey || ""
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("accounts")
      .select("id, platform, username, display_name, avatar_url")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ accounts: data });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}