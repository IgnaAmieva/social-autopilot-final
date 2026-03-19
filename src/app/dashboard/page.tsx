"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, useMemo } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import Navbar from "@/components/Navbar";

type TweetTone = "casual" | "professional" | "humorous" | "inspiracional" | "educativo" | "provocativo";

const TONE_LABELS: Record<TweetTone, string> = {
  casual: "Casual",
  professional: "Profesional",
  humorous: "Humorístico",
  inspiracional: "Inspiracional",
  educativo: "Educativo",
  provocativo: "Provocativo",
};

interface GeneratedTweet {
  id: string;
  text: string;
  tone: string;
  scheduled_time: string;
  status: "published" | "scheduled" | "failed";
  error?: string;
}

interface ApiResponse {
  success: boolean;
  tweetsGenerated: number;
  tweetsPublished: number;
  tweetsFailed: number;
  tweets: GeneratedTweet[];
  summary: string;
  error?: string;
}

interface RecentPost {
  id: string;
  content: string;
  tone: string | null;
  status: string;
  scheduled_time: string | null;
  created_at: string;
  accounts: { username: string } | null;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    scheduled: "bg-blue-100 text-blue-700 border border-blue-200",
    published: "bg-green-100 text-green-700 border border-green-200",
    failed: "bg-red-100 text-red-700 border border-red-200",
    draft: "bg-gray-100 text-gray-600 border border-gray-200",
  };
  const labels: Record<string, string> = {
    scheduled: "Programado",
    published: "Publicado",
    failed: "Fallido",
    draft: "Borrador",
  };
  return (
    <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${styles[status] ?? "bg-gray-100 text-gray-600"}`}>
      {labels[status] ?? status}
    </span>
  );
}

export default function DashboardPage() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState<TweetTone>("casual");
  const [count, setCount] = useState(5);
  const [publishNow, setPublishNow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedTweets, setGeneratedTweets] = useState<GeneratedTweet[]>([]);
  const [apiSummary, setApiSummary] = useState<string | null>(null);

  const [recentPosts, setRecentPosts] = useState<RecentPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");

  const fetchRecentPosts = useCallback(async () => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
    setLoadingPosts(true);
    let query = supabase
      .from("ai_generated_posts")
      .select("id, content, tone, status, scheduled_time, created_at, accounts(username)")
      .order("created_at", { ascending: false })
      .limit(50);

    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    if (dateFilter) query = query.gte("created_at", `${dateFilter}T00:00:00`);

    const { data } = await query;
    if (data) setRecentPosts(data as unknown as RecentPost[]);
    setLoadingPosts(false);
  }, [statusFilter, dateFilter, supabase]);

  useEffect(() => { fetchRecentPosts(); }, [fetchRecentPosts]);

  async function handleGenerate() {
    if (!topic.trim()) { setError("Escribe un tema primero"); return; }
    setLoading(true);
    setError(null);
    setGeneratedTweets([]);
    setApiSummary(null);

    try {
      const res = await fetch("/api/ai/generate-and-publish-v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), tone, count, publishNow }),
      });
      const data: ApiResponse = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? data.summary ?? "Error al generar tweets");
        return;
      }
      setGeneratedTweets(data.tweets);
      setApiSummary(data.summary);
      fetchRecentPosts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Dashboard de Generación</h1>
          <p className="text-gray-500 mt-1">Genera tweets en español con IA y prográmalos automáticamente.</p>
        </div>

        {/* Main layout: form left + preview right */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* ---- FORM (left, 33%) ---- */}
          <div className="lg:w-1/3 shrink-0">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm sticky top-24">
              <h2 className="font-semibold text-gray-900 mb-5 text-base">Configurar generación</h2>

              <div className="space-y-4">
                {/* Tema */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
                    Tema *
                  </label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
                    placeholder="ej: inteligencia artificial, productividad..."
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
                  />
                </div>

                {/* Tono */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
                    Tono
                  </label>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value as TweetTone)}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition bg-white"
                  >
                    {(Object.entries(TONE_LABELS) as [TweetTone, string][]).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>

                {/* Cantidad */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
                    Cantidad: <span className="text-blue-600 font-bold">{count}</span>
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={100}
                    value={count}
                    onChange={(e) => setCount(Number(e.target.value))}
                    className="w-full accent-blue-500 mt-1"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>1</span><span>50</span><span>100</span>
                  </div>
                </div>

                {/* Publicar ahora toggle */}
                <div className="flex items-center justify-between py-1">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Publicar Ahora</p>
                    <p className="text-xs text-gray-400">Off = programar en 24h</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPublishNow(!publishNow)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${publishNow ? "bg-blue-500" : "bg-gray-200"}`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                        publishNow ? "translate-x-7" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                {/* Error */}
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                {/* Success */}
                {apiSummary && !error && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                    ✓ {apiSummary}
                  </div>
                )}

                {/* Botón generar */}
                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-xl text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-500/20"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                      Generando {count} tweets...
                    </span>
                  ) : (
                    `🚀 Generar ${count} Tweet${count !== 1 ? "s" : ""}`
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* ---- PREVIEW + TABLE (right, 67%) ---- */}
          <div className="flex-1 space-y-6">
            {/* Generated tweets preview */}
            {generatedTweets.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-semibold text-gray-900">Vista previa</h2>
                  <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                    {generatedTweets.length} tweets
                  </span>
                </div>
                <div className="space-y-3">
                  {generatedTweets.map((tweet, i) => (
                    <div
                      key={tweet.id}
                      className="border border-gray-100 rounded-xl p-4 hover:border-blue-200 hover:bg-blue-50/20 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 font-mono w-5 shrink-0">#{i + 1}</span>
                          <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-md font-medium">
                            {TONE_LABELS[tweet.tone as TweetTone] ?? tweet.tone}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <StatusBadge status={tweet.status} />
                          <span className="text-xs text-gray-400">
                            {tweet.text.length}/280
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-800 leading-relaxed">{tweet.text}</p>
                      {tweet.error && (
                        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1 mt-2 font-mono break-all">
                          Error: {tweet.error}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-2">
                        📅 {new Date(tweet.scheduled_time).toLocaleString("es-ES", {
                          day: "2-digit", month: "short",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent posts */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <h2 className="font-semibold text-gray-900">Tweets Recientes</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-blue-400"
                  >
                    <option value="all">Todos los estados</option>
                    <option value="scheduled">Programado</option>
                    <option value="published">Publicado</option>
                    <option value="failed">Fallido</option>
                  </select>
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-blue-400"
                  />
                  {(statusFilter !== "all" || dateFilter) && (
                    <button
                      onClick={() => { setStatusFilter("all"); setDateFilter(""); }}
                      className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      Limpiar
                    </button>
                  )}
                  <button
                    onClick={fetchRecentPosts}
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors px-1"
                    title="Actualizar"
                  >
                    ↻
                  </button>
                </div>
              </div>

              {loadingPosts ? (
                <div className="py-12 text-center text-gray-400 text-sm">Cargando...</div>
              ) : recentPosts.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-sm">
                  No hay tweets todavía.{" "}
                  <button onClick={() => setStatusFilter("all")} className="text-blue-500 underline">
                    Ver todos
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-2">
                  <table className="w-full text-sm min-w-[540px]">
                    <thead>
                      <tr className="text-left border-b border-gray-100">
                        <th className="pb-3 pl-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Cuenta</th>
                        <th className="pb-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Tono</th>
                        <th className="pb-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tweet</th>
                        <th className="pb-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide w-36">Horario</th>
                        <th className="pb-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {recentPosts.map((post) => (
                        <tr key={post.id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-3 pl-2 pr-4 text-xs text-gray-500">
                            @{post.accounts?.username ?? "—"}
                          </td>
                          <td className="py-3 pr-4">
                            <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-md">
                              {TONE_LABELS[post.tone as TweetTone] ?? post.tone ?? "—"}
                            </span>
                          </td>
                          <td className="py-3 pr-4 max-w-xs">
                            <span title={post.content} className="block truncate text-gray-700 text-xs">
                              {post.content}
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-gray-400 text-xs whitespace-nowrap">
                            {post.scheduled_time
                              ? new Date(post.scheduled_time).toLocaleString("es-ES", {
                                  day: "2-digit", month: "short",
                                  hour: "2-digit", minute: "2-digit",
                                })
                              : "—"}
                          </td>
                          <td className="py-3">
                            <StatusBadge status={post.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
