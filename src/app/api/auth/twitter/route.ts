import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.TWITTER_CLIENT_ID!;
  // Debe coincidir EXACTAMENTE con lo configurado en X Developer
  const redirectUri = "https://127.0.0.1:3000/api/auth/twitter/callback";

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "tweet.read tweet.write users.read offline.access",
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  const authUrl = `https://twitter.com/i/oauth2/authorize?${params.toString()}`;

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("twitter_code_verifier", codeVerifier, {
    httpOnly: true,
    secure: false,
    maxAge: 600,
    path: "/",
    sameSite: "lax",
    domain: undefined,
  });
  response.cookies.set("twitter_oauth_state", state, {
    httpOnly: true,
    secure: false,
    maxAge: 600,
    path: "/",
    sameSite: "lax",
    domain: undefined,
  });

  return response;
}

function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(digest));
}

function base64UrlEncode(buffer: Uint8Array): string {
  let str = "";
  buffer.forEach((byte) => (str += String.fromCharCode(byte)));
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}