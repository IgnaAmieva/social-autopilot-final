"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import Link from "next/link";
import Navbar from "@/components/Navbar";

// ─── Types ────────────────────────────────────────────────────────────────────

type TweetTone =
  | "casual"
  | "professional"
  | "humorous"
  | "inspiracional"
  | "educativo"
  | "provocativo";

const TONE_LABELS: Record<TweetTone, string> = {
  casual: "Casual",
  professional: "Profesional",
  humorous: "Humorístico",
  inspiracional: "Inspiracional",
  educativo: "Educativo",
  provocativo: "Provocativo",
};

interface AccountOption {
  id: string;
  username: string;
  enabled: boolean;
  niche: string | null;
  tone: string | null;
  language: string | null;
  evergreen_only: boolean;
  tweets_per_day_default: number;
  typefully_api_key: string | null;
  typefully_social_set_id: number | null;
}

interface GeneratedTweet {
  id: string;
  text: string;
  tone: string;
  scheduled_time: string;
  status: "published" | "scheduled" | "failed";
  account?: string;
  error?: string;
}

interface ApiResponse {
  success: boolean;
  batchId?: string;
  tweetsGenerated: number;
  tweetsScheduled: number;
  tweetsFailed: number;
  tweets: GeneratedTweet[];
  summary: string;
  error?: string;
}

interface RecentPost {
  id: string;
  account_id: string;
  content: string;
  tone: string | null;
  status: string;
  scheduled_time: string | null;
  typefully_draft_id: string | null;
  created_at: string;
  accounts: { username: string } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── Small components ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    scheduled: "bg-orange-50 text-orange-700 border border-orange-200",
    published: "bg-green-50 text-green-700 border border-green-200",
    failed:    "bg-red-50 text-red-700 border border-red-200",
    draft:     "bg-stone-100 text-stone-500 border border-stone-200",
  };
  const labels: Record<string, string> = {
    scheduled: "Programado",
    published: "Publicado",
    failed:    "Fallido",
    draft:     "Borrador",
  };
  return (
    <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${styles[status] ?? "bg-stone-100 text-stone-500"}`}>
      {labels[status] ?? status}
    </span>
  );
}

function AccountBadge({ account }: { account: AccountOption }) {
  const hasCredentials = !!(account.typefully_api_key && account.typefully_social_set_id);
  return (
    <div
      className={`rounded-xl border p-3 text-xs space-y-1 ${
        hasCredentials
          ? "border-red-100 bg-red-50/20"
          : "border-orange-100 bg-orange-50/40"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold text-gray-800">@{account.username}</span>
        {!hasCredentials && (
          <Link href="/accounts" className="text-orange-600 hover:underline font-medium">
            Configurar →
          </Link>
        )}
      </div>
      {account.niche && (
        <p className="text-gray-500">
          <span className="font-medium">Nicho:</span> {account.niche}
        </p>
      )}
      <div className="flex gap-3 text-gray-400">
        {account.tone && <span>Tono: {TONE_LABELS[account.tone as TweetTone] ?? account.tone}</span>}
        {account.language && <span>Idioma: {account.language.toUpperCase()}</span>}
        {account.evergreen_only && <span className="text-green-600 font-medium">Evergreen</span>}
      </div>
      {!hasCredentials && (
        <p className="text-orange-600 font-medium">Falta API key o Social Set ID de Typefully</p>
      )}
    </div>
  );
}

// ─── Edit modal ───────────────────────────────────────────────────────────────

interface EditModalProps {
  post: RecentPost;
  onClose: () => void;
  onSaved: (updated: RecentPost) => void;
}

function EditModal({ post, onClose, onSaved }: EditModalProps) {
  const [content, setContent] = useState(post.content);
  const [scheduledTime, setScheduledTime] = useState(toDatetimeLocal(post.scheduled_time));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { textareaRef.current?.focus(); }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  async function handleSave() {
    if (!content.trim()) { setError("El contenido no puede estar vacío"); return; }
    if (content.length > 280) { setError("Máximo 280 caracteres"); return; }

    setSaving(true);
    setError(null);

    try {
      const body: Record<string, string> = { content };
      if (scheduledTime) body.scheduled_time = new Date(scheduledTime).toISOString();

      const res = await fetch(`/api/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Error al guardar"); return; }
      onSaved({ ...post, content, scheduled_time: body.scheduled_time ?? post.scheduled_time });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setSaving(false);
    }
  }

  const charCount = content.length;
  const charOk = charCount > 0 && charCount <= 280;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 border border-stone-100">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Editar tweet</h3>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 text-lg leading-none transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="text-xs text-stone-500 space-y-1">
          <p><span className="font-medium">Cuenta:</span> @{post.accounts?.username ?? "—"}</p>
          {post.typefully_draft_id && (
            <p className="text-stone-400">Draft ID: {post.typefully_draft_id} · Se actualizará en Typefully</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
            Contenido
          </label>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
            className="w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 resize-none focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100 transition"
          />
          <p className={`text-xs mt-1 text-right ${charOk ? "text-stone-400" : "text-red-600"}`}>
            {charCount}/280
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
            Fecha y hora programada
          </label>
          <input
            type="datetime-local"
            value={scheduledTime}
            onChange={(e) => setScheduledTime(e.target.value)}
            className="w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100 transition"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm text-stone-600 hover:text-stone-800 border border-stone-200 rounded-lg hover:bg-stone-50 transition disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !charOk}
            className="nd-btn-primary px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full" />
                Guardando...
              </span>
            ) : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete confirm inline ────────────────────────────────────────────────────

interface DeleteConfirmProps {
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}

function DeleteConfirm({ onConfirm, onCancel, loading }: DeleteConfirmProps) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-xs text-stone-500">¿Eliminar?</span>
      <button onClick={onConfirm} disabled={loading} className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50">
        {loading ? "..." : "Sí"}
      </button>
      <button onClick={onCancel} disabled={loading} className="text-xs text-stone-400 hover:text-stone-600 disabled:opacity-50">
        No
      </button>
    </span>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const supabase = useMemo(() => getSupabaseClient(), []);

  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [accountId, setAccountId] = useState<string>("");
  const selectedAccount = accounts.find((a) => a.id === accountId) ?? null;

  const [topic, setTopic] = useState("");
  const [days, setDays] = useState(1);
  const [tweetsPerDay, setTweetsPerDay] = useState(5);
  const [publishNow, setPublishNow] = useState(false);
  const [evergreenOverride, setEvergreenOverride] = useState<boolean | null>(null);

  const evergreenActive =
    evergreenOverride !== null ? evergreenOverride : (selectedAccount?.evergreen_only ?? false);
  const totalTweets = days * tweetsPerDay;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedTweets, setGeneratedTweets] = useState<GeneratedTweet[]>([]);
  const [apiSummary, setApiSummary] = useState<string | null>(null);

  const [recentPosts, setRecentPosts] = useState<RecentPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");

  const [editingPost, setEditingPost] = useState<RecentPost | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then(({ accounts: data }) => {
        if (data?.length) {
          setAccounts(data);
          setAccountId(data[0].id);
          setTweetsPerDay(data[0].tweets_per_day_default ?? 5);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedAccount) {
      setTweetsPerDay(selectedAccount.tweets_per_day_default ?? 5);
      setEvergreenOverride(null);
    }
  }, [accountId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchRecentPosts = useCallback(async () => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
    setLoadingPosts(true);

    let query = supabase
      .from("ai_generated_posts")
      .select("id, account_id, content, tone, status, scheduled_time, typefully_draft_id, created_at, accounts!account_id(username)")
      .order("created_at", { ascending: false })
      .limit(50);

    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    if (dateFilter) query = query.gte("created_at", `${dateFilter}T00:00:00`);
    if (accountId) query = query.eq("account_id", accountId);

    const { data, error: fetchError } = await query;
    if (fetchError) console.error("[dashboard] fetchRecentPosts error:", fetchError);
    if (data) setRecentPosts(data as unknown as RecentPost[]);
    setLoadingPosts(false);
  }, [statusFilter, dateFilter, accountId, supabase]);

  useEffect(() => { fetchRecentPosts(); }, [fetchRecentPosts]);

  async function handleGenerate() {
    if (!topic.trim()) { setError("Escribe un tema primero"); return; }
    if (!accountId) { setError("Selecciona una cuenta"); return; }
    if (!selectedAccount?.typefully_social_set_id) {
      setError("Esta cuenta no tiene Social Set ID de Typefully. Configúrala en /accounts.");
      return;
    }

    setLoading(true);
    setError(null);
    setGeneratedTweets([]);
    setApiSummary(null);

    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const startDate = tomorrow.toISOString().split("T")[0];

      const res = await fetch("/api/ai/generate-and-publish-v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), days, tweetsPerDay, publishNow, evergreenOnly: evergreenActive, accountId, startDate }),
      });

      const data: ApiResponse = await res.json();
      if (data.tweets?.length) setGeneratedTweets(data.tweets);

      if (!res.ok || !data.success) {
        if (!data.tweets?.length) { setError(data.error ?? data.summary ?? "Error al generar tweets"); return; }
        setError(data.summary ?? data.error ?? "Algunos tweets fallaron");
        fetchRecentPosts();
        return;
      }

      setApiSummary(data.summary);
      fetchRecentPosts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(postId: string) {
    setDeletingId(postId);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/posts/${postId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { setDeleteError(data.error ?? "Error al eliminar"); setDeletingId(null); return; }
      setRecentPosts((prev) => prev.filter((p) => p.id !== postId));
      setConfirmDeleteId(null);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setDeletingId(null);
    }
  }

  function handlePostSaved(updated: RecentPost) {
    setRecentPosts((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
  }

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/posts/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: accountId || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSyncResult(`Error: ${data.error ?? "sync fallido"}`);
      } else {
        setSyncResult(`Sync OK — revisados ${data.checked}, actualizados ${data.updated}`);
        fetchRecentPosts();
      }
    } catch (e) {
      setSyncResult(`Error: ${e instanceof Error ? e.message : "desconocido"}`);
    } finally {
      setSyncing(false);
    }
  }

  // ── shared input class ─────────────────────────────────────────────────────
  const inputBase = "w-full border border-stone-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 bg-white placeholder:text-stone-400 focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100 transition";
  const inputSmall = "w-full border border-stone-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100 transition";

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar />

      {editingPost && (
        <EditModal post={editingPost} onClose={() => setEditingPost(null)} onSaved={handlePostSaved} />
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Dashboard de Generación</h1>
            <p className="text-stone-500 mt-1">Genera y programa contenido evergreen por cuenta.</p>
          </div>
          <Link
            href="/accounts"
            className="nd-btn-secondary text-sm font-medium rounded-lg px-3 py-1.5 transition-colors"
          >
            Gestionar cuentas →
          </Link>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* ── Form (left 33%) ───────────────────────────────────────────── */}
          <div className="lg:w-1/3 shrink-0">
            <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm sticky top-24 space-y-5">
              <h2 className="font-semibold text-gray-900 text-base">Configurar generación</h2>

              {/* Account selector */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
                  Cuenta *
                </label>
                {accounts.length === 0 ? (
                  <p className="text-sm text-stone-400">Cargando cuentas...</p>
                ) : (
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className={inputBase}
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        @{a.username}{a.niche ? ` — ${a.niche}` : ""}
                      </option>
                    ))}
                  </select>
                )}
                {selectedAccount && (
                  <div className="mt-2">
                    <AccountBadge account={selectedAccount} />
                  </div>
                )}
              </div>

              {/* Topic */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
                  Tema *
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
                  placeholder="ej: productividad, inteligencia artificial..."
                  className={inputBase}
                />
              </div>

              {/* Days × tweets per day */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">Días</label>
                  <input
                    type="number" min={1} max={90} value={days}
                    onChange={(e) => setDays(Math.max(1, Math.min(90, Number(e.target.value))))}
                    className={inputSmall}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">Tweets/día</label>
                  <input
                    type="number" min={1} max={20} value={tweetsPerDay}
                    onChange={(e) => setTweetsPerDay(Math.max(1, Math.min(20, Number(e.target.value))))}
                    className={inputSmall}
                  />
                </div>
              </div>

              {/* Total */}
              <div className="bg-stone-50 rounded-xl px-4 py-2.5 flex items-center justify-between border border-stone-100">
                <span className="text-xs text-stone-500">Total a generar</span>
                <span className="text-lg font-bold text-red-700">{totalTweets} tweets</span>
              </div>

              {/* Toggles */}
              <div className="space-y-3">
                {/* Evergreen */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Contenido Evergreen</p>
                    <p className="text-xs text-stone-400">Sin referencias temporales</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEvergreenOverride(!evergreenActive)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${evergreenActive ? "bg-green-500" : "bg-stone-200"}`}
                  >
                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${evergreenActive ? "translate-x-7" : "translate-x-1"}`} />
                  </button>
                </div>

                {/* Publish now */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Publicar Ahora</p>
                    <p className="text-xs text-stone-400">Off = programar desde mañana</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPublishNow(!publishNow)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${publishNow ? "bg-red-700" : "bg-stone-200"}`}
                  >
                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${publishNow ? "translate-x-7" : "translate-x-1"}`} />
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {apiSummary && !error && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                  ✓ {apiSummary}
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={loading || !accountId}
                className="nd-btn-primary w-full text-white font-semibold py-3 rounded-xl text-sm"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                    Generando {totalTweets} tweets...
                  </span>
                ) : `Generar ${totalTweets} Tweet${totalTweets !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>

          {/* ── Right panel ──────────────────────────────────────────────── */}
          <div className="flex-1 space-y-6">
            {/* Generated preview */}
            {generatedTweets.length > 0 && (
              <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-semibold text-gray-900">Vista previa</h2>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
                    {generatedTweets.filter((t) => t.status !== "failed").length} programados
                  </span>
                </div>
                <div className="space-y-3">
                  {generatedTweets.map((tweet, i) => (
                    <div
                      key={tweet.id}
                      className="border border-stone-100 rounded-xl p-4 hover:border-red-100 hover:bg-red-50/20 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-stone-400 font-mono w-5 shrink-0">#{i + 1}</span>
                          <span className="bg-stone-100 text-stone-600 text-xs px-2 py-0.5 rounded-md font-medium">
                            {TONE_LABELS[tweet.tone as TweetTone] ?? tweet.tone}
                          </span>
                          {tweet.account && <span className="text-xs text-stone-400">@{tweet.account}</span>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <StatusBadge status={tweet.status} />
                          <span className="text-xs text-stone-400">{tweet.text.length}/280</span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-800 leading-relaxed">{tweet.text}</p>
                      {tweet.error && (
                        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1 mt-2 font-mono break-all">
                          Error: {tweet.error}
                        </p>
                      )}
                      <p className="text-xs text-stone-400 mt-2">
                        {new Date(tweet.scheduled_time).toLocaleString("es-ES", {
                          weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                        })}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tweets list */}
            <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <h2 className="font-semibold text-gray-900">
                  Tweets Programados
                  {selectedAccount && (
                    <span className="ml-2 text-xs font-normal text-stone-400">@{selectedAccount.username}</span>
                  )}
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-white border border-stone-200 rounded-lg px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-100"
                  >
                    <option value="all">Todos los estados</option>
                    <option value="scheduled">Programado</option>
                    <option value="published">Publicado</option>
                    <option value="failed">Fallido</option>
                  </select>
                  <input
                    type="date" value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="bg-white border border-stone-200 rounded-lg px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-red-600"
                  />
                  {(statusFilter !== "all" || dateFilter) && (
                    <button
                      onClick={() => { setStatusFilter("all"); setDateFilter(""); }}
                      className="text-xs text-stone-400 hover:text-stone-600"
                    >
                      Limpiar
                    </button>
                  )}
                  <button
                    onClick={fetchRecentPosts}
                    disabled={loadingPosts}
                    className="text-xs text-stone-400 hover:text-stone-600 px-1 disabled:opacity-40"
                    title="Actualizar lista"
                  >
                    {loadingPosts ? (
                      <span className="animate-spin inline-block w-3 h-3 border border-stone-400 border-t-transparent rounded-full" />
                    ) : "↻"}
                  </button>
                  <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="nd-btn-secondary text-xs font-medium rounded-md px-2.5 py-1 transition-colors disabled:opacity-40"
                    title="Sincronizar estado con Typefully"
                  >
                    {syncing ? "Sincronizando..." : "Sync Typefully"}
                  </button>
                </div>
              </div>

              {syncResult && (
                <div
                  className={`text-xs px-3 py-2 rounded-lg mb-4 ${
                    syncResult.startsWith("Error")
                      ? "bg-red-50 text-red-700 border border-red-200"
                      : "bg-green-50 text-green-700 border border-green-200"
                  }`}
                >
                  {syncResult}
                </div>
              )}

              {deleteError && (
                <div className="text-xs px-3 py-2 rounded-lg mb-4 bg-red-50 text-red-700 border border-red-200">
                  {deleteError}
                </div>
              )}

              {loadingPosts ? (
                <div className="py-12 text-center text-stone-400 text-sm">Cargando...</div>
              ) : recentPosts.length === 0 ? (
                <div className="py-12 text-center text-stone-400 text-sm">
                  No hay tweets todavía.{" "}
                  <button onClick={() => setStatusFilter("all")} className="text-red-700 underline">Ver todos</button>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-2">
                  <table className="w-full text-sm min-w-[640px]">
                    <thead>
                      <tr className="text-left border-b border-stone-100">
                        {["Cuenta", "Tono", "Tweet", "Horario", "Estado", "Acciones"].map((h) => (
                          <th key={h} className="pb-3 pl-2 pr-4 text-xs font-semibold text-stone-500 uppercase tracking-wide last:pr-0">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                      {recentPosts.map((post) => (
                        <tr key={post.id} className="hover:bg-stone-50/70 transition-colors">
                          <td className="py-3 pl-2 pr-4 text-xs text-stone-500">
                            @{post.accounts?.username ?? "—"}
                          </td>
                          <td className="py-3 pr-4">
                            <span className="bg-stone-100 text-stone-600 text-xs px-2 py-0.5 rounded-md">
                              {TONE_LABELS[post.tone as TweetTone] ?? post.tone ?? "—"}
                            </span>
                          </td>
                          <td className="py-3 pr-4 max-w-xs">
                            <span title={post.content} className="block truncate text-gray-700 text-xs">
                              {post.content}
                            </span>
                            {post.typefully_draft_id && (
                              <span className="text-stone-300 text-xs">TF</span>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-stone-400 text-xs whitespace-nowrap">
                            {post.scheduled_time
                              ? new Date(post.scheduled_time).toLocaleString("es-ES", {
                                  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                                })
                              : "—"}
                          </td>
                          <td className="py-3 pr-4">
                            <StatusBadge status={post.status} />
                          </td>
                          <td className="py-3 pr-2">
                            {confirmDeleteId === post.id ? (
                              <DeleteConfirm
                                onConfirm={() => handleDelete(post.id)}
                                onCancel={() => { setConfirmDeleteId(null); setDeleteError(null); }}
                                loading={deletingId === post.id}
                              />
                            ) : (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setEditingPost(post)}
                                  className="text-xs text-red-700 hover:text-red-900 font-medium"
                                >
                                  Editar
                                </button>
                                <span className="text-stone-200">|</span>
                                <button
                                  onClick={() => { setConfirmDeleteId(post.id); setDeleteError(null); }}
                                  className="text-xs text-stone-400 hover:text-red-600 font-medium transition-colors"
                                >
                                  Eliminar
                                </button>
                              </div>
                            )}
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
