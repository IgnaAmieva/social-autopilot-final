"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { createBrowserClient } from "@supabase/ssr";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

// ─── Formulario ───────────────────────────────────────────────────────────────

function LoginForm() {
  const searchParams = useSearchParams();
  const isForbidden = searchParams.get("error") === "forbidden";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    isForbidden ? "Tu cuenta no tiene acceso a esta aplicación." : null
  );

  // Supabase browser client — usa cookies (no localStorage), legible por middleware
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    if (isForbidden) setError("Tu cuenta no tiene acceso a esta aplicación.");
  }, [isForbidden]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      setError(
        authError.message === "Invalid login credentials"
          ? "Email o contraseña incorrectos."
          : authError.message
      );
      setLoading(false);
      return;
    }

    // Recarga completa para que el middleware lea las cookies de sesión
    window.location.replace("/dashboard");
  }

  const inputCls =
    "w-full border border-stone-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-stone-400 focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100 transition";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "#0d0d0d" }}>
      {/* Logo */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-16 h-16 rounded-full overflow-hidden mb-4 ring-1 ring-white/10 shadow-2xl">
          <Image
            src="/brand/ndsocial-rocket.png"
            width={64}
            height={64}
            alt="NDSocial"
            className="w-full h-full object-cover"
            priority
          />
        </div>
        <h1 className="text-white font-bold text-xl tracking-tight">
          NDS<span className="font-light text-white/55">ocial</span>
          <span className="font-semibold" style={{ color: "#ffffff" }}>Autopilot</span>
        </h1>
        <p className="text-white/35 text-xs mt-1 tracking-widest uppercase">
          Marketing Agency
        </p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-white/5 p-8">
        <h2 className="text-gray-900 font-semibold text-lg mb-1">Iniciar sesión</h2>
        <p className="text-stone-400 text-sm mb-6">Acceso privado · NDSocial</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              autoComplete="email"
              placeholder="tu@email.com"
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className={inputCls}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="nd-btn-primary w-full text-white font-semibold py-3 rounded-xl text-sm mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                Iniciando sesión...
              </span>
            ) : (
              "Iniciar sesión"
            )}
          </button>
        </form>
      </div>

      <p className="text-white/20 text-xs mt-8">
        NDSocial Marketing Agency · Acceso privado
      </p>
    </div>
  );
}

// ─── Page (Suspense requerido por useSearchParams) ────────────────────────────

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
