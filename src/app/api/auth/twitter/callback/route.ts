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

  const codeVerifier = request.cookies.get("twitter_code_verifier")?.value;

  if (!code) {
    return NextResponse.redirect(`${baseUrl}?error=missing_code`);
  }

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
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error("[OAuth] Token exchange failed:", tokenData);
      return NextResponse.redirect(
        `${baseUrl}?error=token_failed&detail=${tokenData.error || "unknown"}`
      );
    }

    const userResponse = await fetch("https://api.twitter.com/2/users/me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const userData = await userResponse.json();

    if (!userResponse.ok) {
      console.error("[OAuth] User info fetch failed:", userData);
      return NextResponse.redirect(`${baseUrl}?error=user_info_failed`);
    }

    // Only insert columns that exist in the accounts table.
    // display_name and updated_at do NOT exist — excluded intentionally.
    const { error: dbError } = await supabase.from("accounts").upsert(
      {
        username: userData.data.username,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        token_expires_at: tokenData.expires_in
          ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
          : null,
        enabled: true,
      },
      { onConflict: "username" }
    );

    if (dbError) {
      console.error("[OAuth] DB upsert failed:", dbError);
      return NextResponse.redirect(`${baseUrl}?error=db_failed`);
    }

    const response = NextResponse.redirect(`${baseUrl}?success=connected`);
    response.cookies.delete("twitter_code_verifier");
    response.cookies.delete("twitter_oauth_state");
    return response;
  } catch (err) {
    console.error("[OAuth] Unexpected error:", err);
    return NextResponse.redirect(`${baseUrl}?error=unknown`);
  }
}
