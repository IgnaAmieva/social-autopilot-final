// src/lib/typefully.ts

const TYPEFULLY_API_BASE = 'https://api.typefully.com/v2';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TypefullyPost {
  text: string;
}

export interface TypefullyDraftPlatform {
  enabled: boolean;
  posts: TypefullyPost[];
}

export interface TypefullyDraft {
  id: string;
  platforms: {
    x: TypefullyDraftPlatform;
  };
  status: string;
  created_at: string;
  publish_at?: string | null;
}

export interface TypefullySocialSet {
  id: string;
  username: string;
  name: string;
  profile_image_url: string;
  team: {
    id: string;
    name: string;
  };
}

export interface UpdateDraftPayload {
  content?: string;
  publishAt?: string | null; // ISO string or null to clear
}

// ─── Key helpers ──────────────────────────────────────────────────────────────

function sanitizeKey(raw: string): string {
  return raw
    .replace(/[\r\n\t]/g, '')
    .replace(/\u200B/g, '')
    .replace(/\uFEFF/g, '')
    .trim();
}

function maskKey(apiKey: string): string {
  if (apiKey.length <= 8) return '***';
  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
}

function headers(apiKey: string): Record<string, string> {
  const cleaned = sanitizeKey(apiKey);
  return {
    Authorization: `Bearer ${cleaned}`,
    'Content-Type': 'application/json',
  };
}

// ─── Diagnostic log (called before any request that might 401) ────────────────

function logKeyDiagnostics(
  label: string,
  rawKey: string,
  context: { username?: string; accountId?: string; socialSetId?: string }
) {
  const cleaned = sanitizeKey(rawKey);
  console.log(`[Typefully][${label}] key diagnostics:`);
  if (context.username) console.log(`  username:        ${context.username}`);
  if (context.accountId) console.log(`  accountId:       ${context.accountId}`);
  if (context.socialSetId) console.log(`  socialSetId:     ${context.socialSetId}`);
  console.log(`  rawKey.length:   ${rawKey.length}`);
  console.log(`  cleanKey.length: ${cleaned.length}`);
  console.log(`  first4:          ${cleaned.slice(0, 4)}`);
  console.log(`  last4:           ${cleaned.slice(-4)}`);
  console.log(`  wasModified:     ${rawKey !== cleaned}`);
  console.log(`  invisibleChars:  ${/[\r\n\t\u200B\uFEFF]/.test(rawKey)}`);
  console.log(`  Authorization:   Bearer ${maskKey(cleaned)}`);
}

// ─── Internal fetch helper ────────────────────────────────────────────────────

async function typefullyFetch(
  method: string,
  url: string,
  apiKey: string,
  body?: unknown
): Promise<{ status: number; text: string }> {
  const opts: RequestInit = { method, headers: headers(apiKey) };
  if (body !== undefined) opts.body = JSON.stringify(body);

  console.log(`[Typefully] ${method} ${url} (key=${maskKey(sanitizeKey(apiKey))})`);
  const res = await fetch(url, opts);
  const text = await res.text();
  console.log(`[Typefully] ${method} ${url} → status=${res.status} body=${text.slice(0, 300)}`);
  return { status: res.status, text };
}

function parseOrThrow<T>(text: string, context: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Typefully devolvió respuesta no-JSON en ${context}: ${text}`);
  }
}

function throwIfError(status: number, text: string, context: string): void {
  if (status === 401) throw new Error('API key de Typefully inválida o no autorizada');
  if (status === 404) throw new Error(`Recurso no encontrado en Typefully (${context})`);
  if (!String(status).startsWith('2')) {
    throw new Error(`Typefully ${status} en ${context}: ${text}`);
  }
}

// ─── Social sets ──────────────────────────────────────────────────────────────

export async function getTypefullySocialSets(apiKey: string): Promise<{
  results: TypefullySocialSet[];
  count: number;
}> {
  const url = `${TYPEFULLY_API_BASE}/social-sets`;
  const { status, text } = await typefullyFetch('GET', url, apiKey);
  throwIfError(status, text, 'GET /social-sets');
  return parseOrThrow(text, 'GET /social-sets');
}

/**
 * Returns the list of social sets for the given API key as a flat array.
 * Convenience wrapper over getTypefullySocialSets.
 */
export async function listTypefullySocialSets(apiKey: string): Promise<TypefullySocialSet[]> {
  const { results } = await getTypefullySocialSets(apiKey);
  return results;
}

export async function verifyTypefullyCredentials(
  apiKey: string,
  socialSetId: string,
  context?: { username?: string; accountId?: string }
): Promise<void> {
  logKeyDiagnostics('verifyCredentials', apiKey, { ...context, socialSetId });

  const url = `${TYPEFULLY_API_BASE}/social-sets`;
  const { status, text } = await typefullyFetch('GET', url, apiKey);
  throwIfError(status, text, 'GET /social-sets (verify)');

  const parsed = parseOrThrow<{ results?: TypefullySocialSet[] }>(text, 'verify credentials');
  const socialSets = parsed.results ?? [];

  console.log(
    `[Typefully] social sets (${socialSets.length}): ${socialSets.map((s) => `${s.id}(@${s.username})`).join(', ') || 'none'}`
  );

  const found = socialSets.some((s) => String(s.id) === String(socialSetId));
  if (!found) {
    throw new Error(
      `API key válida pero sin acceso al social set ${socialSetId}. Disponibles: ${socialSets.map((s) => s.id).join(', ') || 'ninguno'}`
    );
  }
  console.log(`[Typefully] credentials OK — socialSetId=${socialSetId}`);
}

// ─── Drafts CRUD ──────────────────────────────────────────────────────────────

export async function listTypefullyDrafts(
  apiKey: string,
  socialSetId: string
): Promise<TypefullyDraft[]> {
  const url = `${TYPEFULLY_API_BASE}/social-sets/${socialSetId}/drafts`;
  const { status, text } = await typefullyFetch('GET', url, apiKey);
  throwIfError(status, text, `GET /social-sets/${socialSetId}/drafts`);

  const parsed = parseOrThrow<TypefullyDraft[] | { results: TypefullyDraft[] }>(
    text,
    'listTypefullyDrafts'
  );
  return Array.isArray(parsed) ? parsed : (parsed.results ?? []);
}

export async function getTypefullyDraft(
  apiKey: string,
  socialSetId: string,
  draftId: string
): Promise<TypefullyDraft> {
  const url = `${TYPEFULLY_API_BASE}/social-sets/${socialSetId}/drafts/${draftId}`;
  const { status, text } = await typefullyFetch('GET', url, apiKey);
  throwIfError(status, text, `GET draft ${draftId}`);
  return parseOrThrow(text, `getTypefullyDraft ${draftId}`);
}

export async function updateTypefullyDraft(
  apiKey: string,
  socialSetId: string,
  draftId: string,
  payload: UpdateDraftPayload
): Promise<TypefullyDraft> {
  const url = `${TYPEFULLY_API_BASE}/social-sets/${socialSetId}/drafts/${draftId}`;

  const body: Record<string, unknown> = {};

  if (payload.content !== undefined) {
    body.platforms = {
      x: {
        enabled: true,
        posts: [{ text: payload.content }],
      },
    };
  }

  if (payload.publishAt !== undefined) {
    body.publish_at = payload.publishAt;
  }

  const { status, text } = await typefullyFetch('PATCH', url, apiKey, body);
  throwIfError(status, text, `PATCH draft ${draftId}`);
  return parseOrThrow(text, `updateTypefullyDraft ${draftId}`);
}

export async function deleteTypefullyDraft(
  apiKey: string,
  socialSetId: string,
  draftId: string
): Promise<void> {
  const url = `${TYPEFULLY_API_BASE}/social-sets/${socialSetId}/drafts/${draftId}`;
  const { status, text } = await typefullyFetch('DELETE', url, apiKey);

  // 404 on delete = already gone, treat as success
  if (status === 404) {
    console.log(`[Typefully] DELETE draft ${draftId} — 404 (already deleted), treating as OK`);
    return;
  }
  throwIfError(status, text, `DELETE draft ${draftId}`);
}

// ─── Create / publish draft (existing, kept intact) ───────────────────────────

export async function createTypefullyDraft(
  apiKey: string,
  socialSetId: string,
  content: string,
  publishAt?: string,
  context?: { username?: string; accountId?: string }
): Promise<TypefullyDraft> {
  await verifyTypefullyCredentials(apiKey, socialSetId, context);

  const cleaned = sanitizeKey(apiKey);
  const url = `${TYPEFULLY_API_BASE}/social-sets/${socialSetId}/drafts`;

  const payload: Record<string, unknown> = {
    platforms: {
      x: {
        enabled: true,
        posts: [{ text: content }],
      },
    },
  };

  if (publishAt === 'now') {
    payload.publish_at = new Date().toISOString();
  } else if (publishAt) {
    payload.publish_at = publishAt;
  }

  console.log(`[Typefully] POST ${url} (key=${maskKey(cleaned)})`);
  console.log(`[Typefully] payload: ${JSON.stringify(payload)}`);

  const { status, text } = await typefullyFetch('POST', url, apiKey, payload);
  throwIfError(status, text, `POST /social-sets/${socialSetId}/drafts`);

  const draft = parseOrThrow<TypefullyDraft>(text, 'createTypefullyDraft');

  if (!draft.id) {
    throw new Error(`Typefully respondió OK pero sin draft.id. Body: ${text}`);
  }

  return draft;
}

export async function publishTypefullyDraft(
  apiKey: string,
  socialSetId: string,
  draftId: string
): Promise<Record<string, unknown>> {
  const url = `${TYPEFULLY_API_BASE}/social-sets/${socialSetId}/drafts/${draftId}`;
  const { status, text } = await typefullyFetch('PATCH', url, apiKey, {
    publish_at: new Date().toISOString(),
  });
  throwIfError(status, text, `PATCH publish draft ${draftId}`);
  return parseOrThrow(text, `publishTypefullyDraft ${draftId}`);
}
