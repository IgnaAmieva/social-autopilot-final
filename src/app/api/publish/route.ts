import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

// POST: publicar un post específico por ID
export async function POST(request: NextRequest) {
  const supabase = getSupabaseClient();
  const body = await request.json();
  const { post_id } = body;

  if (!post_id) {
    return NextResponse.json({ error: "post_id es requerido" }, { status: 400 });
  }

  const { data: post, error: postError } = await supabase
    .from("posts")
    .select("*, accounts(*)")
    .eq("id", post_id)
    .single();

  if (postError || !post) {
    return NextResponse.json({ error: "Post no encontrado" }, { status: 404 });
  }

  if (post.status === "published") {
    return NextResponse.json({ error: "El post ya fue publicado" }, { status: 400 });
  }

  const result = await publishTweet(supabase, post);
  return NextResponse.json(result);
}

// GET: publicar todos los posts programados cuya hora ya pasó
export async function GET() {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  const { data: posts, error } = await supabase
    .from("posts")
    .select("*, accounts(*)")
    .eq("status", "scheduled")
    .lte("scheduled_at", now);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!posts || posts.length === 0) {
    return NextResponse.json({ message: "No hay posts pendientes", published: 0 });
  }

  const results = [];
  for (const post of posts) {
    const result = await publishTweet(supabase, post);
    results.push(result);
  }

  const published = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return NextResponse.json({
    message: `Procesados: ${results.length}. Publicados: ${published}. Fallidos: ${failed}`,
    published,
    failed,
    results,
  });
}

async function publishTweet(
  supabase: SupabaseClient,
  post: {
    id: string;
    content: string;
    accounts: {
      access_token: string;
      refresh_token: string | null;
      token_expires_at: string | null;
      id: string;
    };
  }
) {
  // Mark as publishing (no updated_at — column does not exist in accounts)
  await supabase
    .from("posts")
    .update({ status: "publishing" })
    .eq("id", post.id);

  try {
    let accessToken = post.accounts.access_token;

    if (post.accounts.token_expires_at && post.accounts.refresh_token) {
      const expiresAt = new Date(post.accounts.token_expires_at);
      if (expiresAt < new Date()) {
        const newToken = await refreshAccessToken(
          supabase,
          post.accounts.refresh_token,
          post.accounts.id
        );
        if (newToken) {
          accessToken = newToken;
        } else {
          throw new Error("No se pudo refrescar el token");
        }
      }
    }

    const tweetResponse = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: post.content }),
    });

    const tweetData = await tweetResponse.json();

    if (!tweetResponse.ok) {
      throw new Error(tweetData.detail || tweetData.title || "Error al publicar en X");
    }

    await supabase
      .from("posts")
      .update({
        status: "published",
        platform_post_id: tweetData.data.id,
        published_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", post.id);

    return { success: true, post_id: post.id, tweet_id: tweetData.data.id };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error desconocido";
    console.error("[publish] Tweet failed:", errorMessage);

    await supabase
      .from("posts")
      .update({ status: "failed", error_message: errorMessage })
      .eq("id", post.id);

    return { success: false, post_id: post.id, error: errorMessage };
  }
}

async function refreshAccessToken(
  supabase: SupabaseClient,
  refreshToken: string,
  accountId: string
): Promise<string | null> {
  try {
    const response = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          `${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`
        ).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[publish] Refresh token error:", data);
      return null;
    }

    // Update OAuth tokens only — no updated_at (column does not exist)
    await supabase
      .from("accounts")
      .update({
        access_token: data.access_token,
        refresh_token: data.refresh_token || refreshToken,
        token_expires_at: data.expires_in
          ? new Date(Date.now() + data.expires_in * 1000).toISOString()
          : null,
      })
      .eq("id", accountId);

    return data.access_token;
  } catch (err) {
    console.error("[publish] Refresh error:", err);
    return null;
  }
}
