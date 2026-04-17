/**
 * Seed 20 test accounts in Supabase
 * Usage: npx ts-node --skip-project scripts/seed-accounts.ts
 *
 * Requires env vars (auto-loaded from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  (or NEXT_PUBLIC_SUPABASE_ANON_KEY as fallback)
 */

import { readFileSync } from "fs";
import { join } from "path";
import { createClient } from "@supabase/supabase-js";

// Load .env.local into process.env
function loadEnvLocal() {
  try {
    const content = readFileSync(join(process.cwd(), ".env.local"), "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx < 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (key && !process.env[key]) {
        process.env[key] = val;
      }
    }
    console.log("✓ Loaded .env.local");
  } catch {
    console.log("⚠ .env.local not found, using existing env vars");
  }
}

loadEnvLocal();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Typefully social set ID shared by all test accounts
const TYPEFULLY_SOCIAL_SET_ID = 291333;

async function seedAccounts() {
  console.log("\n🌱 Seeding 20 test accounts...\n");

  const accounts = Array.from({ length: 20 }, (_, i) => {
    const n = i + 1;
    return {
      username: `test_account_${n}`,
      typefully_social_set_id: TYPEFULLY_SOCIAL_SET_ID,
      typefully_api_key: null,
      niche: null,
      subniche: null,
      system_prompt: null,
      tone: "casual",
      language: "es",
      evergreen_only: false,
      tweets_per_day_default: 5,
      enabled: true,
    };
  });

  const { data, error } = await supabase
    .from("accounts")
    .insert(accounts)
    .select("id, username");

  if (error) {
    console.error("❌ Error inserting accounts:", error.message);
    console.error("   Hint: You may need SUPABASE_SERVICE_ROLE_KEY to bypass RLS.");
    process.exit(1);
  }

  console.log(`✅ Inserted ${data?.length ?? 0} accounts:\n`);
  data?.forEach((a) => console.log(`   • ${a.username} (${a.id})`));

  console.log("\n🎉 Done! Run the dashboard to see them in action.");
}

seedAccounts().catch((err) => {
  console.error("❌ Unexpected error:", err);
  process.exit(1);
});