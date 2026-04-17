"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";

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

interface AccountConfig {
  id: string;
  username: string;
  enabled: boolean;
  typefully_social_set_id: number | null;
  niche: string | null;
  subniche: string | null;
  system_prompt: string | null;
  tone: string | null;
  language: string | null;
  evergreen_only: boolean;
  tweets_per_day_default: number;
  created_at: string;
}

interface EditState {
  typefully_api_key: string;
  typefully_social_set_id: string;
  enabled: boolean;
  niche: string;
  subniche: string;
  system_prompt: string;
  tone: string;
  language: string;
  evergreen_only: boolean;
  tweets_per_day_default: number;
}

function toEditState(a: AccountConfig): EditState {
  return {
    typefully_api_key: "",
    typefully_social_set_id: a.typefully_social_set_id !== null ? String(a.typefully_social_set_id) : "",
    enabled: a.enabled ?? true,
    niche: a.niche ?? "",
    subniche: a.subniche ?? "",
    system_prompt: a.system_prompt ?? "",
    tone: a.tone ?? "casual",
    language: a.language ?? "es",
    evergreen_only: a.evergreen_only ?? false,
    tweets_per_day_default: a.tweets_per_day_default ?? 5,
  };
}

// ── Shared classes ─────────────────────────────────────────────────────────────
const inputCls =
  "w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-stone-400 focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100 transition";

const selectCls =
  "w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100 transition";

const labelCls = "block text-xs font-semibold text-gray-700 mb-1.5";

const sectionHeadCls =
  "text-xs font-bold text-stone-500 uppercase tracking-widest mb-3";

function Toggle({
  checked,
  onChange,
  activeColor = "bg-red-700",
}: {
  checked: boolean;
  onChange: () => void;
  activeColor?: string;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
        checked ? activeColor : "bg-stone-300"
      }`}
    >
      <span
        className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function AccountCard({ account, onSaved }: { account: AccountConfig; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<EditState>(toEditState(account));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  const hasCredentials = !!account.typefully_social_set_id;

  function setField<K extends keyof EditState>(key: K, value: EditState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaveOk(false);

    const socialSetId = form.typefully_social_set_id.trim();
    const parsedSocialSetId = socialSetId === "" ? null : Number.parseInt(socialSetId, 10);

    if (socialSetId !== "" && Number.isNaN(parsedSocialSetId)) {
      setSaveError("El Social Set ID debe ser un número válido (ej: 291333)");
      setSaving(false);
      return;
    }

    const payload: Record<string, unknown> = {
      typefully_social_set_id: parsedSocialSetId,
      enabled: form.enabled,
      niche: form.niche.trim() || null,
      subniche: form.subniche.trim() || null,
      system_prompt: form.system_prompt.trim() || null,
      tone: form.tone,
      language: form.language,
      evergreen_only: form.evergreen_only,
      tweets_per_day_default: form.tweets_per_day_default,
    };

    if (form.typefully_api_key.trim()) {
      payload.typefully_api_key = form.typefully_api_key.trim();
    }

    try {
      const res = await fetch(`/api/accounts/${account.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setSaveError(data.error ?? "Error al guardar");
      } else {
        setSaveOk(true);
        onSaved();
        setForm((prev) => ({ ...prev, typefully_api_key: "" }));
        setTimeout(() => setSaveOk(false), 3000);
      }
    } catch {
      setSaveError("Error de red al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
        hasCredentials ? "border-stone-200" : "border-orange-200"
      }`}
    >
      {/* Card header */}
      <div
        className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-stone-50 transition-colors select-none"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
            style={{ background: "linear-gradient(135deg, #7f1d1d 0%, #c2410c 100%)" }}
          >
            {account.username[0]?.toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">@{account.username}</p>
            <p className="text-xs text-stone-400 mt-0.5">{account.niche ?? "Sin nicho definido"}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!hasCredentials && (
            <span className="text-xs bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-md font-medium">
              Sin credenciales
            </span>
          )}
          {account.evergreen_only && (
            <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-md font-medium">
              Evergreen
            </span>
          )}
          {!account.enabled && (
            <span className="text-xs bg-stone-100 text-stone-500 border border-stone-200 px-2 py-0.5 rounded-md font-medium">
              Deshabilitada
            </span>
          )}
          <span className="text-stone-400 text-xs ml-1">{open ? "▲" : "▼"}</span>
        </div>
      </div>

      {/* Edit form */}
      {open && (
        <div className="px-6 pb-6 border-t border-stone-100 pt-5 space-y-6">
          {/* Typefully section */}
          <section>
            <h3 className={sectionHeadCls}>Typefully</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>API Key</label>
                <input
                  type="password"
                  value={form.typefully_api_key}
                  onChange={(e) => setField("typefully_api_key", e.target.value)}
                  placeholder={account.typefully_social_set_id ? "Dejar vacío para no cambiar" : "Pega tu API key aquí"}
                  className={inputCls}
                  autoComplete="new-password"
                />
                <p className="text-xs text-stone-400 mt-1">Solo se actualiza si escribís algo aquí.</p>
              </div>

              <div>
                <label className={labelCls}>Social Set ID</label>
                <input
                  type="text"
                  value={form.typefully_social_set_id}
                  onChange={(e) => setField("typefully_social_set_id", e.target.value)}
                  placeholder="ej: 291333"
                  className={inputCls}
                />
                <p className="text-xs text-stone-400 mt-1">
                  Número entero — lo encontrás en Typefully → Settings.
                </p>
              </div>

              <div className="flex items-center gap-3 sm:col-span-2">
                <Toggle checked={form.enabled} onChange={() => setField("enabled", !form.enabled)} />
                <div>
                  <p className="text-sm font-medium text-gray-700">Cuenta habilitada</p>
                  <p className="text-xs text-stone-400">Las cuentas deshabilitadas no reciben tweets generados.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Editorial section */}
          <section>
            <h3 className={sectionHeadCls}>Configuración Editorial</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Nicho</label>
                <input
                  type="text"
                  value={form.niche}
                  onChange={(e) => setField("niche", e.target.value)}
                  placeholder="ej: productividad, finanzas personales..."
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Sub-nicho</label>
                <input
                  type="text"
                  value={form.subniche}
                  onChange={(e) => setField("subniche", e.target.value)}
                  placeholder="ej: GTD, ahorro para millennials..."
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Tono por defecto</label>
                <select
                  value={form.tone}
                  onChange={(e) => setField("tone", e.target.value)}
                  className={selectCls}
                >
                  {(Object.entries(TONE_LABELS) as [TweetTone, string][]).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelCls}>Idioma</label>
                <select
                  value={form.language}
                  onChange={(e) => setField("language", e.target.value)}
                  className={selectCls}
                >
                  <option value="es">Español</option>
                  <option value="en">English</option>
                  <option value="pt">Português</option>
                  <option value="fr">Français</option>
                </select>
              </div>

              <div>
                <label className={labelCls}>Tweets por día (default)</label>
                <input
                  type="number" min={1} max={20}
                  value={form.tweets_per_day_default}
                  onChange={(e) => setField("tweets_per_day_default", Math.max(1, Math.min(20, Number(e.target.value))))}
                  className={inputCls}
                />
              </div>

              <div className="flex items-center gap-3 pt-1">
                <Toggle
                  checked={form.evergreen_only}
                  onChange={() => setField("evergreen_only", !form.evergreen_only)}
                  activeColor="bg-green-500"
                />
                <div>
                  <p className="text-sm font-medium text-gray-700">Evergreen obligatorio</p>
                  <p className="text-xs text-stone-400">Bloquea referencias a fechas y eventos actuales.</p>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <label className={labelCls}>Prompt editorial — voz de la cuenta</label>
              <textarea
                value={form.system_prompt}
                onChange={(e) => setField("system_prompt", e.target.value)}
                rows={5}
                placeholder={`Describí la voz y estilo de esta cuenta. Ejemplo:\n"Cuenta de productividad para emprendedores latinos. Tono directo y sin rodeos. Frases cortas. Cita datos cuando sea posible. Evita el lenguaje corporativo. Nunca uses clichés motivacionales."`}
                className={`${inputCls} resize-none leading-relaxed`}
              />
              <p className="text-xs text-stone-400 mt-1.5">
                Este texto se inyecta en el prompt de IA para mantener la voz de la cuenta en cada generación.
              </p>
            </div>
          </section>

          {saveError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm font-medium">
              {saveError}
            </div>
          )}
          {saveOk && (
            <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm font-medium">
              ✓ Configuración guardada correctamente
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="nd-btn-primary w-full text-white font-semibold py-2.5 rounded-xl text-sm"
          >
            {saving ? "Guardando..." : "Guardar configuración"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Sync result type ─────────────────────────────────────────────────────────

interface SyncResult {
  ok: boolean;
  total: number;
  created: number;
  updated: number;
  unchanged: number;
  errors: string[];
  detail: { socialSetId: number; username: string; action: string }[];
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<AccountConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  async function loadAccounts() {
    try {
      const res = await fetch("/api/accounts");
      const data = await res.json();
      setAccounts(data.accounts ?? []);
    } catch (e) {
      console.error("[accounts page] load error:", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    setSyncError(null);
    try {
      const res = await fetch("/api/accounts/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setSyncError(data.error ?? "Error al sincronizar");
      } else {
        setSyncResult(data as SyncResult);
        if (data.created > 0 || data.updated > 0) {
          await loadAccounts();
        }
      }
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => { loadAccounts(); }, []);

  const configured = accounts.filter((a) => a.typefully_social_set_id);
  const unconfigured = accounts.filter((a) => !a.typefully_social_set_id);

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Gestión de Cuentas</h1>
            <p className="text-stone-500 mt-1">
              Configurá las credenciales de Typefully y la identidad editorial de cada cuenta.
            </p>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="nd-btn-secondary shrink-0 inline-flex items-center gap-2 text-sm font-medium rounded-lg px-4 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {syncing ? (
              <>
                <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-red-300 border-t-red-700 rounded-full" />
                Sincronizando...
              </>
            ) : (
              "↻ Sync cuentas desde Typefully"
            )}
          </button>
        </div>

        {/* Sync feedback */}
        {syncError && (
          <div className="mb-5 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            {syncError}
          </div>
        )}
        {syncResult && (
          <div
            className={`mb-5 rounded-xl px-4 py-3 text-sm border ${
              syncResult.errors.length > 0
                ? "bg-amber-50 border-amber-200 text-amber-800"
                : "bg-green-50 border-green-200 text-green-700"
            }`}
          >
            <p className="font-medium mb-1">
              {syncResult.created > 0 || syncResult.updated > 0
                ? `Sync completado — ${syncResult.created} nueva${syncResult.created !== 1 ? "s" : ""}, ${syncResult.updated} actualizada${syncResult.updated !== 1 ? "s" : ""}, ${syncResult.unchanged} sin cambios`
                : `Todo actualizado — ${syncResult.unchanged} cuenta${syncResult.unchanged !== 1 ? "s" : ""} sin cambios`}
            </p>
            {syncResult.detail.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-xs opacity-80">
                {syncResult.detail.map((d) => (
                  <li key={d.socialSetId}>
                    @{d.username}{" "}
                    <span className="font-mono">({d.socialSetId})</span>
                    {" — "}
                    {d.action === "created" ? "nueva" : d.action === "updated" ? "actualizada" : "sin cambios"}
                  </li>
                ))}
              </ul>
            )}
            {syncResult.errors.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-xs text-red-700">
                {syncResult.errors.map((e, i) => <li key={i}>⚠ {e}</li>)}
              </ul>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "Total cuentas", value: accounts.length, color: "text-gray-900" },
            { label: "Configuradas", value: configured.length, color: "text-green-600" },
            { label: "Sin configurar", value: unconfigured.length, color: "text-orange-600" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-stone-200 p-4 shadow-sm text-center">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-stone-500 mt-1">{label}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="py-20 text-center text-stone-400">Cargando cuentas...</div>
        ) : accounts.length === 0 ? (
          <div className="py-20 text-center text-stone-400">
            <p>No hay cuentas todavía.</p>
            <p className="mt-2 text-sm">
              Configurá una API key de Typefully y usá{" "}
              <button onClick={handleSync} className="text-red-700 underline hover:text-red-900">
                Sync cuentas desde Typefully
              </button>{" "}
              para importarlas.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {unconfigured.map((a) => <AccountCard key={a.id} account={a} onSaved={loadAccounts} />)}
            {configured.map((a) => <AccountCard key={a.id} account={a} onSaved={loadAccounts} />)}
          </div>
        )}
      </div>
    </div>
  );
}
