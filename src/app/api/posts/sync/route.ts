// src/app/api/posts/sync/route.ts
//
// POST /api/posts/sync
// Body: { accountId?: string }
//
// Reconcilia el estado de ai_generated_posts con Typefully.
// Para cada post scheduled+con typefully_draft_id, consulta Typefully y actualiza:
//   - status → 'published' si el draft reporta status published/sent
//   - scheduled_time si cambió en Typefully

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getTypefullyDraft } from "@/lib/typefully";

interface AccountRow {
  id: string;
  username: string;
  typefully_api_key: string | null;
  typefully_social_set_id: number | null;
}

interface PostRow {
  id: string;
  account_id: string;
  status: string;
  scheduled_time: string | null;
  typefully_draft_id: string | null;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { accountId } = body as { accountId?: string };

  const supabase = getSupabaseAdmin();

  // ── Fetch accounts ────────────────────────────────────────────────────────
  let accountsQuery = supabase
    .from("accounts")
    .select("id, username, typefully_api_key, typefully_social_set_id")
    .eq("enabled", true)
    .not("typefully_api_key", "is", null)
    .not("typefully_social_set_id", "is", null);

  if (accountId) {
    accountsQuery = accountsQuery.eq("id", accountId);
  }

  const { data: accounts, error: accErr } = await accountsQuery;

  if (accErr) {
    return NextResponse.json({ error: accErr.message }, { status: 500 });
  }

  if (!accounts || accounts.length === 0) {
    return NextResponse.json({ error: "No se encontraron cuentas con credenciales Typefully" }, { status: 400 });
  }

  const results: { accountId: string; checked: number; updated: number; errors: string[] }[] = [];

  for (const account of accounts as AccountRow[]) {
    const accountResult = { accountId: account.id, checked: 0, updated: 0, errors: [] as string[] };

    // ── Fetch scheduled posts with typefully_draft_id ─────────────────────
    const { data: posts, error: postsErr } = await supabase
      .from("ai_generated_posts")
      .select("id, account_id, status, scheduled_time, typefully_draft_id")
      .eq("account_id", account.id)
      .eq("status", "scheduled")
      .not("typefully_draft_id", "is", null);

    if (postsErr) {
      accountResult.errors.push(`DB error fetching posts: ${postsErr.message}`);
      results.push(accountResult);
      continue;
    }

    if (!posts || posts.length === 0) {
      console.log(`[sync] @${account.username} — no scheduled posts with typefully_draft_id`);
      results.push(accountResult);
      continue;
    }

    console.log(`[sync] @${account.username} — checking ${posts.length} posts`);

    for (const post of posts as PostRow[]) {
      accountResult.checked++;

      try {
        const draft = await getTypefullyDraft(
          account.typefully_api_key!,
          String(account.typefully_social_set_id!),
          post.typefully_draft_id!
        );

        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
        let needsUpdate = false;

        // Status reconciliation
        const typefullyStatus = draft.status?.toLowerCase() ?? '';
        const isPublished = ['published', 'sent', 'posted'].includes(typefullyStatus);
        if (isPublished && post.status !== 'published') {
          updates.status = 'published';
          updates.published_at = new Date().toISOString();
          needsUpdate = true;
          console.log(`[sync] post ${post.id} → published (Typefully status: ${draft.status})`);
        }

        // Scheduled time reconciliation
        if (draft.publish_at && draft.publish_at !== post.scheduled_time) {
          updates.scheduled_time = draft.publish_at;
          needsUpdate = true;
          console.log(`[sync] post ${post.id} → scheduled_time updated to ${draft.publish_at}`);
        }

        if (needsUpdate) {
          const { error: updateErr } = await supabase
            .from("ai_generated_posts")
            .update(updates)
            .eq("id", post.id);

          if (updateErr) {
            const msg = `Supabase update failed for post ${post.id}: ${updateErr.message}`;
            console.error(`[sync] ${msg}`);
            accountResult.errors.push(msg);
          } else {
            accountResult.updated++;
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // If draft is 404 in Typefully, it was probably deleted externally
        if (msg.includes('404') || msg.includes('no encontrado')) {
          console.warn(`[sync] post ${post.id} draft not found in Typefully — marking as failed`);
          await supabase
            .from("ai_generated_posts")
            .update({ status: 'failed', error_message: 'Draft eliminado en Typefully', updated_at: new Date().toISOString() })
            .eq("id", post.id);
          accountResult.updated++;
        } else {
          console.error(`[sync] post ${post.id} error: ${msg}`);
          accountResult.errors.push(`post ${post.id}: ${msg}`);
        }
      }
    }

    results.push(accountResult);
  }

  const totalChecked = results.reduce((s, r) => s + r.checked, 0);
  const totalUpdated = results.reduce((s, r) => s + r.updated, 0);
  const totalErrors = results.reduce((s, r) => s + r.errors.length, 0);

  return NextResponse.json({
    ok: true,
    accounts: results.length,
    checked: totalChecked,
    updated: totalUpdated,
    errors: totalErrors,
    detail: results,
  });
}
