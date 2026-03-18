import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const supabase = getSupabaseClient();
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  const baseUrl = "http://localhost:3000";

  if (error) {
    return NextResponse.redirect(`${baseUrl}?error=${error}`);
  }

  // Buscar code_verifier en cookies (puede estar en localhost o 127.0.0.1)
  const codeVerifier = request.cookies.get("twitter_code_verifier")?.value;

  if (!code) {
    return NextResponse.redirect(`${baseUrl}?error=missing_code`);
  }

  // Si no hay code_verifier (porque las cookies se perdieron al cambiar dominio),
  // lo buscamos del header referer o simplemente intentamos sin él
  if (!codeVerifier) {
    return NextResponse.redirect(`${baseUrl}?error=missing_verifier_try_again`);
  }

  try {
    const redirectUri = "https://127.0.0.1:3000/api/auth/twitter/callback";

    const tokenResponse = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          `${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`
        ).toString("base64")}`,
      },
      body: new URLSearchParams({
        code: code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error("Token error:", tokenData);
      return NextResponse.redirect(
        `${baseUrl}?error=token_failed&detail=${tokenData.error || "unknown"}`
      );
    }

    const userResponse = await fetch("https://api.twitter.com/2/users/me", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const userData = await userResponse.json();

    if (!userResponse.ok) {
      console.error("User info error:", userData);
      return NextResponse.redirect(`${baseUrl}?error=user_info_failed`);
    }

    const { error: dbError } = await supabase.from("accounts").upsert(
      {
        platform: "twitter",
        platform_user_id: userData.data.id,
        username: userData.data.username,
        display_name: userData.data.name,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        token_expires_at: tokenData.expires_in
          ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
          : null,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "platform_user_id",
      }
    );

    if (dbError) {
      console.error("DB error:", dbError);
      return NextResponse.redirect(`${baseUrl}?error=db_failed`);
    }

    const response = NextResponse.redirect(`${baseUrl}?success=connected`);
    response.cookies.delete("twitter_code_verifier");
    response.cookies.delete("twitter_oauth_state");

    return response;
  } catch (err) {
    console.error("Auth error:", err);
    return NextResponse.redirect(`${baseUrl}?error=unknown`);
  }
}