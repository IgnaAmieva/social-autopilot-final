/**
 * Test de integración Typefully desde Node
 * Usa el mismo entorno que la app (supabase-js + fetch nativo de Node).
 *
 * Uso:
 *   npx ts-node --skip-project scripts/test-typefully.ts
 *   npx ts-node --skip-project scripts/test-typefully.ts <account-id>
 */

import { readFileSync } from "fs";
import { join } from "path";
import { createClient } from "@supabase/supabase-js";

// ── Cargar .env.local ─────────────────────────────────────────────────────────
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
    console.log("✓ Cargado .env.local");
  } catch {
    console.log("⚠ .env.local no encontrado, usando vars de entorno existentes");
  }
}

loadEnvLocal();

// ── Sanitización (misma lógica que typefully.ts) ──────────────────────────────
function sanitizeKey(raw: string): string {
  return raw
    .replace(/[\r\n\t]/g, "")
    .replace(/\u200B/g, "")
    .replace(/\uFEFF/g, "")
    .trim();
}

function maskKey(key: string): string {
  if (key.length <= 8) return "***";
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

// ── Supabase ──────────────────────────────────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ── Helpers fetch ─────────────────────────────────────────────────────────────
async function typefullyGet(path: string, cleanedKey: string) {
  const url = `https://api.typefully.com/v2${path}`;
  console.log(`\n  → GET ${url}`);
  console.log(`     Authorization: Bearer ${maskKey(cleanedKey)}`);

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${cleanedKey}`,
      "Content-Type": "application/json",
    },
  });

  let body: unknown;
  const text = await res.text();
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  console.log(`     status: ${res.status}`);
  console.log(`     body:   ${JSON.stringify(body, null, 2)}`);

  return { status: res.status, body };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const targetAccountId = process.argv[2] ?? null;

  console.log("\n=== TEST TYPEFULLY ===\n");

  // 1. Leer cuenta desde Supabase
  console.log(`[1] Leyendo cuenta desde Supabase — accountId=${targetAccountId ?? "primera habilitada"}`);

  let query = supabase
    .from("accounts")
    .select("id, username, typefully_api_key, typefully_social_set_id")
    .eq("enabled", true);

  if (targetAccountId) {
    query = query.eq("id", targetAccountId);
  }

  const { data: accounts, error } = await query.limit(1);

  if (error) {
    console.error("❌ Error leyendo cuenta:", error.message);
    process.exit(1);
  }

  if (!accounts || accounts.length === 0) {
    console.error("❌ No se encontró ninguna cuenta habilitada");
    process.exit(1);
  }

  const account = accounts[0];
  console.log(`   id:            ${account.id}`);
  console.log(`   username:      ${account.username}`);
  console.log(`   socialSetId:   ${account.typefully_social_set_id}`);
  console.log(`   keyExiste:     ${Boolean(account.typefully_api_key)}`);

  if (!account.typefully_api_key) {
    console.error("❌ La cuenta no tiene typefully_api_key configurada");
    process.exit(1);
  }

  // 2. Diagnóstico de la key
  const rawKey: string = account.typefully_api_key;
  const cleanedKey = sanitizeKey(rawKey);

  console.log("\n[2] Diagnóstico de API key:");
  console.log(`   rawKey.length:   ${rawKey.length}`);
  console.log(`   cleanKey.length: ${cleanedKey.length}`);
  console.log(`   primeros4:       ${cleanedKey.slice(0, 4)}`);
  console.log(`   ultimos4:        ${cleanedKey.slice(-4)}`);
  console.log(`   keyModificada:   ${rawKey !== cleanedKey}`);
  console.log(`   charsInvisibles: ${/[\r\n\t\u200B\uFEFF]/.test(rawKey)}`);
  console.log(`   espaciosExtr:    ${rawKey !== rawKey.trim()}`);
  console.log(`   headerFinal:     Authorization: Bearer ${maskKey(cleanedKey)}`);

  // 3. GET /v2/me
  console.log("\n[3] GET /v2/me");
  await typefullyGet("/me", cleanedKey);

  // 4. GET /v2/social-sets
  console.log("\n[4] GET /v2/social-sets");
  const { status, body } = await typefullyGet("/social-sets", cleanedKey);

  if (status === 200) {
    const parsed = body as { results?: Array<{ id: string; username: string }> };
    const sets = parsed.results ?? [];
    console.log(`\n   Social sets encontrados (${sets.length}):`);
    for (const s of sets) {
      const match = String(s.id) === String(account.typefully_social_set_id) ? " ← ESTE" : "";
      console.log(`     • id=${s.id} username=${s.username}${match}`);
    }

    const found = sets.some((s) => String(s.id) === String(account.typefully_social_set_id));
    if (found) {
      console.log(`\n✅ Social set ${account.typefully_social_set_id} ENCONTRADO — integración OK`);
    } else {
      console.warn(`\n⚠ Social set ${account.typefully_social_set_id} NO encontrado entre los disponibles`);
    }
  } else {
    console.error(`\n❌ /social-sets devolvió ${status} — revisar key y permisos`);
  }

  console.log("\n=== FIN ===\n");
}

main().catch((err) => {
  console.error("❌ Error inesperado:", err);
  process.exit(1);
});
