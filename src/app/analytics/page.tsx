"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import Navbar from "@/components/Navbar";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const TONE_LABELS: Record<string, string> = {
  casual: "Casual",
  professional: "Profesional",
  humorous: "Humorístico",
  inspiracional: "Inspiracional",
  educativo: "Educativo",
  provocativo: "Provocativo",
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Programado",
  published: "Publicado",
  failed: "Fallido",
  draft: "Borrador",
};

interface Post {
  id: string;
  content: string;
  tone: string | null;
  status: string;
  scheduled_time: string | null;
  created_at: string;
  account_id: string;
  accounts: { username: string } | null;
}

const PALETTE = ["#3b82f6", "#a78bfa", "#fb923c", "#34d399", "#f87171", "#fbbf24"];

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    scheduled: "bg-blue-100 text-blue-700 border border-blue-200",
    published: "bg-green-100 text-green-700 border border-green-200",
    failed: "bg-red-100 text-red-700 border border-red-200",
    draft: "bg-gray-100 text-gray-600 border border-gray-200",
  };
  return (
    <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${styles[status] ?? "bg-gray-100 text-gray-600"}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function StatCard({ label, value, sub, icon }: { label: string; value: number; sub?: string; icon: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
        <span className="text-xl">{icon}</span>
      </div>
      <p className="text-3xl font-extrabold text-gray-900">{value.toLocaleString("es-ES")}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function AnalyticsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [toneFilter, setToneFilter] = useState("all");

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("ai_generated_posts")
      .select("id, content, tone, status, scheduled_time, created_at, account_id, accounts(username)")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    if (toneFilter !== "all") query = query.eq("tone", toneFilter);
    if (dateFrom) query = query.gte("created_at", `${dateFrom}T00:00:00`);
    if (dateTo) query = query.lte("created_at", `${dateTo}T23:59:59`);

    const { data } = await query;
    if (data) setPosts(data as unknown as Post[]);
    setLoading(false);
  }, [statusFilter, toneFilter, dateFrom, dateTo]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  // --- Stats ---
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfToday.getDate() - 7);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const todayCount = posts.filter(p => new Date(p.created_at) >= startOfToday).length;
  const weekCount = posts.filter(p => new Date(p.created_at) >= startOfWeek).length;
  const monthCount = posts.filter(p => new Date(p.created_at) >= startOfMonth).length;

  // By tone
  const toneMap: Record<string, number> = {};
  posts.forEach(p => { const t = p.tone ?? "sin tono"; toneMap[t] = (toneMap[t] ?? 0) + 1; });
  const toneData = Object.entries(toneMap).map(([name, value], i) => ({
    name: TONE_LABELS[name] ?? name,
    value,
    fill: PALETTE[i % PALETTE.length],
  }));

  // By status
  const statusMap: Record<string, number> = {};
  posts.forEach(p => { statusMap[p.status] = (statusMap[p.status] ?? 0) + 1; });
  const statusData = Object.entries(statusMap).map(([name, value], i) => ({
    name: STATUS_LABELS[name] ?? name,
    value,
    fill: PALETTE[i % PALETTE.length],
  }));

  // By hour
  const hourMap: Record<number, number> = {};
  posts.forEach(p => {
    if (!p.scheduled_time) return;
    const h = new Date(p.scheduled_time).getHours();
    hourMap[h] = (hourMap[h] ?? 0) + 1;
  });
  const hourData = Array.from({ length: 24 }, (_, h) => ({
    hora: `${String(h).padStart(2, "0")}h`,
    tweets: hourMap[h] ?? 0,
  }));

  // Top 5 accounts
  const accountMap: Record<string, number> = {};
  posts.forEach(p => {
    const name = p.accounts?.username ?? p.account_id;
    accountMap[name] = (accountMap[name] ?? 0) + 1;
  });
  const topAccounts = Object.entries(accountMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const last10 = posts.slice(0, 10);
  const hasFilters = statusFilter !== "all" || toneFilter !== "all" || dateFrom || dateTo;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Dashboard de Analytics</h1>
          <p className="text-gray-500 mt-1">Rendimiento y estadísticas de tus tweets generados.</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Filtros</span>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-700 bg-white focus:outline-none focus:border-blue-400"
            >
              <option value="all">Todos los estados</option>
              <option value="scheduled">Programado</option>
              <option value="published">Publicado</option>
              <option value="failed">Fallido</option>
            </select>

            <select
              value={toneFilter}
              onChange={(e) => setToneFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-700 bg-white focus:outline-none focus:border-blue-400"
            >
              <option value="all">Todos los tonos</option>
              {Object.entries(TONE_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Desde</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-blue-400"
              />
              <span className="text-xs text-gray-400">Hasta</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-blue-400"
              />
            </div>

            {hasFilters && (
              <button
                onClick={() => { setStatusFilter("all"); setToneFilter("all"); setDateFrom(""); setDateTo(""); }}
                className="text-xs text-blue-500 hover:text-blue-700 transition-colors font-medium"
              >
                Limpiar filtros
              </button>
            )}

            <span className="ml-auto text-xs text-gray-400">
              {loading ? "Cargando..." : `${posts.length} registros`}
            </span>
          </div>
        </div>

        {/* Stat Cards — 2x2 grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard icon="📅" label="Hoy" value={todayCount} sub="tweets generados hoy" />
          <StatCard icon="📆" label="Esta semana" value={weekCount} sub="últimos 7 días" />
          <StatCard icon="🗓️" label="Este mes" value={monthCount} sub={now.toLocaleString("es-ES", { month: "long" })} />
          <StatCard icon="📊" label="Total filtrado" value={posts.length} sub="con filtros actuales" />
        </div>

        {/* Charts — 3 cols */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Tweets por Tono */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Tweets por Tono</h3>
            {toneData.length === 0 ? (
              <p className="text-center text-gray-400 text-xs py-10">Sin datos</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={toneData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    label={({ name, percent }: { name?: string; percent?: number }) =>
                      `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                    fontSize={10}
                  />
                  <Tooltip
                    contentStyle={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => [v, ""]}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Tweets por Estado */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Tweets por Estado</h3>
            {statusData.length === 0 ? (
              <p className="text-center text-gray-400 text-xs py-10">Sin datos</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={statusData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Top 5 cuentas */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Top 5 Cuentas</h3>
            {topAccounts.length === 0 ? (
              <p className="text-center text-gray-400 text-xs py-10">Sin datos</p>
            ) : (
              <div className="space-y-3 mt-1">
                {topAccounts.map(([name, count], i) => (
                  <div key={name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600 truncate font-medium">@{name}</span>
                      <span className="text-gray-400 ml-2 shrink-0">{count}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(count / (topAccounts[0][1])) * 100}%`,
                          background: PALETTE[i % PALETTE.length],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Mejor horario */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Mejor Horario de Publicación</h3>
          {posts.filter(p => p.scheduled_time).length === 0 ? (
            <p className="text-center text-gray-400 text-xs py-8">Sin datos de horario</p>
          ) : (
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={hourData} margin={{ top: 0, right: 0, bottom: 0, left: -28 }}>
                <XAxis
                  dataKey="hora"
                  tick={{ fontSize: 9, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                  interval={3}
                />
                <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => [`${v ?? 0} tweets`, "Publicaciones"]}
                />
                <Bar dataKey="tweets" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Últimos 10 tweets */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-5">Últimos 10 Tweets</h3>
          {loading ? (
            <p className="text-center text-gray-400 text-xs py-10">Cargando...</p>
          ) : last10.length === 0 ? (
            <p className="text-center text-gray-400 text-xs py-10">Sin tweets todavía</p>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="text-left border-b border-gray-100">
                    {["Cuenta", "Tono", "Tweet", "Horario", "Creado", "Estado"].map(h => (
                      <th key={h} className="pb-3 pl-2 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide last:pr-0">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {last10.map(post => (
                    <tr key={post.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 pl-2 pr-4 text-xs text-gray-500">
                        @{post.accounts?.username ?? "—"}
                      </td>
                      <td className="py-3 pr-4">
                        <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-md">
                          {TONE_LABELS[post.tone ?? ""] ?? post.tone ?? "—"}
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
                      <td className="py-3 pr-4 text-gray-400 text-xs whitespace-nowrap">
                        {new Date(post.created_at).toLocaleString("es-ES", {
                          day: "2-digit", month: "short",
                          hour: "2-digit", minute: "2-digit",
                        })}
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
  );
}
