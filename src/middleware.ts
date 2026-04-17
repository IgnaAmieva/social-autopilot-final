import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// ── Whitelist de emails ───────────────────────────────────────────────────────
// Configura ALLOWED_EMAILS en .env.local (separados por coma si son varios).
// Si la variable está vacía, cualquier usuario autenticado puede entrar.
const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);

// ── Rutas protegidas ──────────────────────────────────────────────────────────
const PROTECTED_PAGES = ["/dashboard", "/accounts", "/analytics"];
const PROTECTED_API   = ["/api/accounts", "/api/posts", "/api/ai"];

export async function middleware(request: NextRequest) {
  // Crear la respuesta base; se reemplaza si hay que setear cookies de sesión
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Propagar cookies al request y a la respuesta (para que el token
          // se refresque automáticamente cuando esté por vencer)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANTE: usar getUser() (no getSession()) — valida el token contra Supabase
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Si el usuario ya tiene sesión y va a /login → mandarlo al dashboard
  if (pathname === "/login" && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Determinar si la ruta requiere autenticación
  const isProtectedPage = PROTECTED_PAGES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  const isProtectedApi = PROTECTED_API.some((p) => pathname.startsWith(p));

  if (!isProtectedPage && !isProtectedApi) {
    return supabaseResponse;
  }

  // ── Sin sesión ────────────────────────────────────────────────────────────
  if (!user) {
    if (isProtectedApi) {
      return NextResponse.json(
        { error: "No autorizado. Iniciá sesión para continuar." },
        { status: 401 }
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // ── Whitelist de email ────────────────────────────────────────────────────
  if (
    ALLOWED_EMAILS.length > 0 &&
    (!user.email || !ALLOWED_EMAILS.includes(user.email))
  ) {
    if (isProtectedApi) {
      return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "forbidden");
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Aplicar a todo excepto assets estáticos de Next.js y archivos públicos de marca
    "/((?!_next/static|_next/image|favicon\\.ico|brand/).*)",
  ],
};
