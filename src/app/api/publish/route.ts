import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// POST: publicar un post específico por ID
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { post_id } = body;

  if (!post_id) {
    return NextResponse.json({ error: "post_id es requerido" }, { status: 400 });
  }

  // Obtener el post con su cuenta
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

  const result = await publishTweet(post);
  return NextResponse.json(result);
}

// GET: publicar todos los posts programados cuya hora ya pasó
export async function GET() {
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
    const result = await publishTweet(post);
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

async function publishTweet(post: {
  id: string;
  content: string;
  accounts: { access_token: string; refresh_token: string | null; token_expires_at: string | null; id: string };
}) {
  // Marcar como "publishing"
  await supabase
    .from("posts")
    .update({ status: "publishing", updated_at: new Date().toISOString() })
    .eq("id", post.id);

  try {
    let accessToken = post.accounts.access_token;

    // Verificar si el token expiró y refrescar si es necesario
    if (post.accounts.token_expires_at && post.accounts.refresh_token) {
      const expiresAt = new Date(post.accounts.token_expires_at);
      if (expiresAt < new Date()) {
        const newToken = await refreshAccessToken(post.accounts.refresh_token, post.accounts.id);
        if (newToken) {
          accessToken = newToken;
        } else {
          throw new Error("No se pudo refrescar el token");
        }
      }
    }

    // Publicar en X
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

    // Actualizar post como publicado
    await supabase
      .from("posts")
      .update({
        status: "published",
        platform_post_id: tweetData.data.id,
        published_at: new Date().toISOString(),
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", post.id);

    return { success: true, post_id: post.id, tweet_id: tweetData.data.id };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error desconocido";

    await supabase
      .from("posts")
      .update({
        status: "failed",
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq("id", post.id);

    return { success: false, post_id: post.id, error: errorMessage };
  }
}

async function refreshAccessToken(refreshToken: string, accountId: string): Promise<string | null> {
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
      console.error("Refresh token error:", data);
      return null;
    }

    // Actualizar tokens en la base de datos
    await supabase
      .from("accounts")
      .update({
        access_token: data.access_token,
        refresh_token: data.refresh_token || refreshToken,
        token_expires_at: data.expires_in
          ? new Date(Date.now() + data.expires_in * 1000).toISOString()
          : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", accountId);

    return data.access_token;
  } catch (err) {
    console.error("Refresh error:", err);
    return null;
  }
}