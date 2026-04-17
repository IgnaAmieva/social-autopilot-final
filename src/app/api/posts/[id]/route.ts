// src/app/api/posts/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  updateTypefullyDraft,
  deleteTypefullyDraft,
  getTypefullyDraft,
} from "@/lib/typefully";

interface PostRow {
  id: string;
  account_id: string;
  content: string;
  tone: string | null;
  status: string;
  scheduled_time: string | null;
  typefully_draft_id: string | null;
  batch_id: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string | null;
}

interface AccountRow {
  id: string;
  username: string;
  typefully_api_key: string | null;
  typefully_social_set_id: number | null;
}

async function getPostWithAccount(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  postId: string
): Promise<{ post: PostRow; account: AccountRow } | { error: string; status: number }> {
  const { data: post, error: postError } = await supabase
    .from("ai_generated_posts")
    .select("*")
    .eq("id", postId)
    .single();

  if (postError || !post) {
    return { error: "Post no encontrado", status: 404 };
  }

  const { data: account, error: accError } = await supabase
    .from("accounts")
    .select("id, username, typefully_api_key, typefully_social_set_id")
    .eq("id", post.account_id)
    .single();

  if (accError || !account) {
    return { error: "Cuenta asociada no encontrada", status: 404 };
  }

  return { post: post as PostRow, account: account as AccountRow };
}

// ─── GET /api/posts/[id] ──────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const result = await getPostWithAccount(supabase, id);

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { post, account } = result;

  // Optionally fetch live state from Typefully
  let typefullyData: unknown = null;
  if (post.typefully_draft_id && account.typefully_api_key && account.typefully_social_set_id) {
    try {
      typefullyData = await getTypefullyDraft(
        account.typefully_api_key,
        String(account.typefully_social_set_id),
        post.typefully_draft_id
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[GET /api/posts/${id}] No se pudo obtener draft de Typefully: ${msg}`);
    }
  }

  return NextResponse.json({
    post,
    account: { id: account.id, username: account.username },
    typefully: typefullyData,
  });
}

// ─── PATCH /api/posts/[id] ────────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { content, scheduled_time } = body as {
    content?: string;
    scheduled_time?: string;
  };

  if (!content && !scheduled_time) {
    return NextResponse.json(
      { error: "Se requiere al menos content o scheduled_time" },
      { status: 400 }
    );
  }

  if (content !== undefined && (content.trim().length === 0 || content.length > 280)) {
    return NextResponse.json(
      { error: "content debe tener entre 1 y 280 caracteres" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();
  const result = await getPostWithAccount(supabase, id);

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { post, account } = result;

  // ── Update Typefully first ────────────────────────────────────────────────
  if (
    post.typefully_draft_id &&
    account.typefully_api_key &&
    account.typefully_social_set_id
  ) {
    try {
      await updateTypefullyDraft(
        account.typefully_api_key,
        String(account.typefully_social_set_id),
        post.typefully_draft_id,
        {
          content: content ?? undefined,
          publishAt: scheduled_time ?? undefined,
        }
      );
      console.log(
        `[PATCH /api/posts/${id}] Typefully draft ${post.typefully_draft_id} actualizado`
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[PATCH /api/posts/${id}] Typefully update FAILED: ${msg}`);
      return NextResponse.json(
        {
          error: `Error al actualizar en Typefully: ${msg}. No se modificó Supabase para evitar inconsistencia.`,
        },
        { status: 502 }
      );
    }
  }

  // ── Update Supabase ───────────────────────────────────────────────────────
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (content !== undefined) updates.content = content;
  if (scheduled_time !== undefined) updates.scheduled_time = scheduled_time;

  const { data: updated, error: updateError } = await supabase
    .from("ai_generated_posts")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (updateError) {
    // Typefully was updated but Supabase failed — log loudly
    console.error(
      `[PATCH /api/posts/${id}] CRITICAL: Typefully actualizado pero Supabase FALLÓ: ${updateError.message}`,
      { postId: id, typefully_draft_id: post.typefully_draft_id }
    );
    return NextResponse.json(
      {
        error: `Typefully fue actualizado, pero falló la sincronización en Supabase: ${updateError.message}`,
        typefully_updated: true,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ post: updated });
}

// ─── DELETE /api/posts/[id] ───────────────────────────────────────────────────
//
// Estrategia: borrado permanente en ambos sistemas.
// - Si Typefully falla con 404 lo trata como ya eliminado.
// - Si Typefully falla por otro motivo, devuelve error y no toca Supabase.
// - Si Supabase falla después de eliminar en Typefully, loguea fuerte.

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const result = await getPostWithAccount(supabase, id);

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { post, account } = result;

  // ── Delete from Typefully first ───────────────────────────────────────────
  if (
    post.typefully_draft_id &&
    account.typefully_api_key &&
    account.typefully_social_set_id
  ) {
    try {
      await deleteTypefullyDraft(
        account.typefully_api_key,
        String(account.typefully_social_set_id),
        post.typefully_draft_id
      );
      console.log(
        `[DELETE /api/posts/${id}] Typefully draft ${post.typefully_draft_id} eliminado`
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[DELETE /api/posts/${id}] Typefully delete FAILED: ${msg}`);
      return NextResponse.json(
        {
          error: `Error al eliminar en Typefully: ${msg}. Supabase no fue modificado.`,
        },
        { status: 502 }
      );
    }
  }

  // ── Delete from Supabase ──────────────────────────────────────────────────
  const { error: deleteError } = await supabase
    .from("ai_generated_posts")
    .delete()
    .eq("id", id);

  if (deleteError) {
    console.error(
      `[DELETE /api/posts/${id}] CRITICAL: Typefully eliminado pero Supabase FALLÓ: ${deleteError.message}`,
      { postId: id, typefully_draft_id: post.typefully_draft_id }
    );
    return NextResponse.json(
      {
        error: `Typefully fue eliminado, pero falló la eliminación en Supabase: ${deleteError.message}`,
        typefully_deleted: true,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ deleted: true, id: id });
}
