// src/app/api/accounts/sync/route.ts
//
// POST /api/accounts/sync
//
// Flujo:
// 1. Recoge todas las typefully_api_key distintas que ya existen en `accounts`
// 2. Para cada key llama GET /v2/social-sets
// 3. Por cada social set devuelto:
//    - Si ya existe una cuenta con ese typefully_social_set_id → actualiza username si cambió
//    - Si no existe → crea la cuenta con defaults editoriales

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { listTypefullySocialSets } from "@/lib/typefully";

interface SyncDetail {
  socialSetId: number;
  username: string;
  action: "created" | "updated" | "unchanged";
}

export async function POST() {
  const supabase = getSupabaseAdmin();

  // ── 1. Obtener API keys existentes ────────────────────────────────────────
  const { data: accountRows, error: accErr } = await supabase
    .from("accounts")
    .select("typefully_api_key")
    .not("typefully_api_key", "is", null);

  if (accErr) {
    return NextResponse.json({ error: accErr.message }, { status: 500 });
  }

  // Deduplicar keys
  const allKeys = (accountRows ?? [])
    .map((r) => r.typefully_api_key as string)
    .filter(Boolean);

  const uniqueKeys = [...new Set(allKeys)];

  if (uniqueKeys.length === 0) {
    return NextResponse.json(
      {
        error:
          "No hay ninguna cuenta con API key de Typefully configurada. " +
          "Entrá a /accounts, abrí una cuenta y pegá tu API key primero.",
      },
      { status: 400 }
    );
  }

  console.log(`[sync/accounts] Usando ${uniqueKeys.length} API key(s) distintas`);

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  const detail: SyncDetail[] = [];
  const errors: string[] = [];

  // ── 2. Por cada key, traer social sets de Typefully ───────────────────────
  for (const apiKey of uniqueKeys) {
    let socialSets;
    try {
      socialSets = await listTypefullySocialSets(apiKey);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[sync/accounts] Error al listar social sets: ${msg}`);
      errors.push(msg);
      continue;
    }

    console.log(`[sync/accounts] ${socialSets.length} social set(s) encontrados`);

    // ── 3. Upsert por socialSetId ─────────────────────────────────────────
    for (const ss of socialSets) {
      const socialSetId = Number(ss.id);

      // Buscar cuenta existente por typefully_social_set_id
      const { data: existing, error: findErr } = await supabase
        .from("accounts")
        .select("id, username")
        .eq("typefully_social_set_id", socialSetId)
        .maybeSingle();

      if (findErr) {
        const msg = `DB error buscando socialSetId=${socialSetId}: ${findErr.message}`;
        console.error(`[sync/accounts] ${msg}`);
        errors.push(msg);
        continue;
      }

      if (existing) {
        // Cuenta ya existe — actualizar username si cambió
        if (existing.username !== ss.username) {
          const { error: updateErr } = await supabase
            .from("accounts")
            .update({ username: ss.username })
            .eq("id", existing.id);

          if (updateErr) {
            const msg = `DB error actualizando username id=${existing.id}: ${updateErr.message}`;
            console.error(`[sync/accounts] ${msg}`);
            errors.push(msg);
            detail.push({ socialSetId, username: ss.username, action: "unchanged" });
          } else {
            console.log(`[sync/accounts] Updated @${ss.username} (id=${socialSetId})`);
            updated++;
            detail.push({ socialSetId, username: ss.username, action: "updated" });
          }
        } else {
          unchanged++;
          detail.push({ socialSetId, username: ss.username, action: "unchanged" });
        }
      } else {
        // Cuenta nueva — insertar con defaults
        const { error: insertErr } = await supabase.from("accounts").insert({
          username: ss.username,
          typefully_social_set_id: socialSetId,
          typefully_api_key: apiKey,
          niche: null,
          subniche: null,
          system_prompt: null,
          tone: "casual",
          language: "es",
          evergreen_only: false,
          tweets_per_day_default: 5,
          enabled: true,
        });

        if (insertErr) {
          const msg = `DB error insertando @${ss.username} (socialSetId=${socialSetId}): ${insertErr.message}`;
          console.error(`[sync/accounts] ${msg}`);
          errors.push(msg);
          detail.push({ socialSetId, username: ss.username, action: "unchanged" });
        } else {
          console.log(`[sync/accounts] Created @${ss.username} (id=${socialSetId})`);
          created++;
          detail.push({ socialSetId, username: ss.username, action: "created" });
        }
      }
    }
  }

  const total = created + updated + unchanged;

  return NextResponse.json({
    ok: errors.length === 0,
    total,
    created,
    updated,
    unchanged,
    errors,
    detail,
  });
}
