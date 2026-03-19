import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Placeholder used during SSR/build when env vars are not yet available.
// Queries will fail gracefully — actual data is only fetched client-side via useEffect.
const PLACEHOLDER_URL = "https://placeholder.supabase.co";
const PLACEHOLDER_KEY = "placeholder-key-build-only";

/** Client with anon key — safe for server-side handlers and client components. */
export function getSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? PLACEHOLDER_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? PLACEHOLDER_KEY;
  return createClient(url, key);
}

/** Client with service role key (bypasses RLS). Falls back to anon key if not set.
 *  Only used in API routes (runtime only — never during build/prerender). */
export function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key);
}
