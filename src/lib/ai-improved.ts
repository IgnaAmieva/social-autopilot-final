// src/lib/ai-improved.ts

import Anthropic from "@anthropic-ai/sdk";

function getAnthropicClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// ── Pricing constants (USD per million tokens) ────────────────────────────────
// Model: claude-haiku-4-5-20251001
// Update these if the model or pricing changes.
const PRICE_INPUT_PER_M  = 0.80;  // $0.80 per 1M input tokens
const PRICE_OUTPUT_PER_M = 4.00;  // $4.00 per 1M output tokens

export type TweetTone =
  | "casual"
  | "professional"
  | "humorous"
  | "inspiracional"
  | "educativo"
  | "provocativo";

export interface GeneratedTweet {
  text: string;
  tone: TweetTone;
  length: number;
}

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  tweets_generated: number;
  avg_tokens_per_tweet: number;
  estimated_cost_usd: number;
  estimated_cost_per_tweet_usd: number;
}

// Fallback tone descriptions — used when account has no system_prompt
const TONE_PROMPTS: Record<TweetTone, string> = {
  casual:        "Tono amigable y conversacional, como hablarle a un amigo. Natural, sin formalismos.",
  professional:  "Tono formal y profesional. Autoridad, credibilidad. Sin jerga.",
  humorous:      "Tono divertido y con humor. Usa ingenio, ironía sutil o referencias pop. Que haga sonreír.",
  inspiracional: "Tono motivador y positivo. Que inspire acción o reflexión.",
  educativo:     "Tono informativo. Enseña algo útil o un dato curioso sobre el tema.",
  provocativo:   "Tono audaz, desafiante. Cuestiona lo establecido. Genera debate.",
};

const EVERGREEN_RULES = `
REGLAS EVERGREEN (OBLIGATORIAS):
- El contenido debe ser atemporal. Sin referencias a fechas, eventos actuales, noticias ni temporadas.
- PROHIBIDO usar: "hoy", "ayer", "esta semana", "este mes", "ahora", "actualmente", "recientemente", "últimamente", "partido de hoy", "noticia de hoy", "trending".
- El tweet debe ser igual de relevante en 1 mes, 6 meses o 1 año.
- Basa el contenido en: patrones universales, ideas atemporales, curiosidades, historia, psicología, principios, preguntas que siempre son válidas.`;

export interface GenerateTweetsConfig {
  topic: string;
  count?: number;
  tone?: string;
  // Editorial config from account
  systemPrompt?: string | null;
  niche?: string | null;
  language?: string | null;
  evergreenOnly?: boolean;
}

async function generateSingleTweet(
  topic: string,
  tone: TweetTone,
  index: number,
  config: Pick<GenerateTweetsConfig, "systemPrompt" | "niche" | "language" | "evergreenOnly">
): Promise<{ tweet: GeneratedTweet; input_tokens: number; output_tokens: number }> {
  const { systemPrompt, niche, language = "es", evergreenOnly = false } = config;
  const toneDesc = TONE_PROMPTS[tone];

  const nicheContext = niche
    ? `\nNicho de la cuenta: "${niche}" — asegúrate de que el contenido sea relevante para esta audiencia.`
    : "";

  const voiceBlock = systemPrompt
    ? `\nVoz editorial de la cuenta:\n${systemPrompt}\n`
    : "";

  const evergreenBlock = evergreenOnly ? EVERGREEN_RULES : "";

  const langInstruction =
    language === "es"
      ? "Escribe el tweet en ESPAÑOL."
      : language === "en"
      ? "Write the tweet in ENGLISH."
      : `Write the tweet in ${language}.`;

  const prompt = `${langInstruction}

Genera un tweet sobre: "${topic}"
${nicheContext}${voiceBlock}
Tono: ${tone.toUpperCase()} — ${toneDesc}
Tweet número ${index + 1}. Hazlo ÚNICO — diferente a los anteriores en ángulo o perspectiva.
${evergreenBlock}
Reglas de formato:
- Máximo 260 caracteres
- 1-2 hashtags relevantes
- 1-2 emojis apropiados
- Sin comillas al inicio o final
- SOLO devuelve el tweet. Sin explicaciones, sin numeración, sin prefijos.`;

  const message = await getAnthropicClient().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 150,
    messages: [{ role: "user", content: prompt }],
  });

  const input_tokens  = message.usage?.input_tokens  ?? 0;
  const output_tokens = message.usage?.output_tokens ?? 0;

  const rawText =
    message.content[0]?.type === "text" ? message.content[0].text.trim() : "";

  if (!rawText) {
    console.error(`[AI] Tweet ${index + 1} devolvió texto vacío. stop_reason=${message.stop_reason}`);
    throw new Error(`Claude devolvió texto vacío para tweet ${index + 1} (stop_reason: ${message.stop_reason})`);
  }

  const text = rawText.replace(/^["'""«]|["'""»]$/g, "").trim();

  console.log(
    `[AI] Tweet ${index + 1} generado — tone=${tone}, chars=${text.length}, ` +
    `tokens=[in=${input_tokens} out=${output_tokens}]`
  );

  return { tweet: { text, tone, length: text.length }, input_tokens, output_tokens };
}

export async function generateTweetsWithAIImproved(
  config: GenerateTweetsConfig
): Promise<{ tweets: GeneratedTweet[]; usage: TokenUsage }> {
  const {
    topic,
    count = 5,
    tone = "casual",
    systemPrompt,
    niche,
    language,
    evergreenOnly,
  } = config;

  const allTones: TweetTone[] = [
    "casual",
    "professional",
    "humorous",
    "inspiracional",
    "educativo",
    "provocativo",
  ];
  const baseTone: TweetTone = allTones.includes(tone as TweetTone)
    ? (tone as TweetTone)
    : "casual";

  const assignedTones: TweetTone[] = Array.from({ length: count }, (_, i) => {
    if (i === 0) return baseTone;
    const others = allTones.filter((t) => t !== baseTone);
    return others[(i - 1) % others.length];
  });

  const editorialConfig = { systemPrompt, niche, language, evergreenOnly };

  const tweets: GeneratedTweet[] = [];
  let totalInput  = 0;
  let totalOutput = 0;

  const batchSize = 5;

  for (let i = 0; i < count; i += batchSize) {
    const batch = assignedTones.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map((t, j) => generateSingleTweet(topic, t, i + j, editorialConfig))
    );
    for (const r of results) {
      tweets.push(r.tweet);
      totalInput  += r.input_tokens;
      totalOutput += r.output_tokens;
    }
  }

  const total_tokens             = totalInput + totalOutput;
  const tweets_generated         = tweets.length;
  const avg_tokens_per_tweet     = tweets_generated > 0 ? Math.round(total_tokens / tweets_generated) : 0;
  const estimated_cost_usd       = parseFloat(
    ((totalInput / 1_000_000) * PRICE_INPUT_PER_M + (totalOutput / 1_000_000) * PRICE_OUTPUT_PER_M).toFixed(6)
  );
  const estimated_cost_per_tweet_usd = parseFloat(
    (tweets_generated > 0 ? estimated_cost_usd / tweets_generated : 0).toFixed(6)
  );

  const usage: TokenUsage = {
    input_tokens:               totalInput,
    output_tokens:              totalOutput,
    total_tokens,
    tweets_generated,
    avg_tokens_per_tweet,
    estimated_cost_usd,
    estimated_cost_per_tweet_usd,
  };

  console.log(`[TOKENS] input=${totalInput}`);
  console.log(`[TOKENS] output=${totalOutput}`);
  console.log(`[TOKENS] total=${total_tokens}`);
  console.log(`[TOKENS] avg_per_tweet=${avg_tokens_per_tweet}`);
  console.log(`[TOKENS] estimated_cost_usd=$${estimated_cost_usd}`);
  console.log(`[TOKENS] estimated_cost_per_tweet_usd=$${estimated_cost_per_tweet_usd}`);

  return { tweets, usage };
}

/**
 * Distributes scheduled_time slots across N days starting from startDate.
 * Tweets are spread through a daily window (8:00 – 22:00) with slight jitter.
 */
export function distributeScheduleTimes(
  days: number,
  tweetsPerDay: number,
  startDate?: Date
): Date[] {
  const times: Date[] = [];

  const base = startDate ?? (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(8, 0, 0, 0);
    return d;
  })();

  const WINDOW_START_HOUR = 8;
  const WINDOW_END_HOUR   = 22;
  const WINDOW_MINUTES    = (WINDOW_END_HOUR - WINDOW_START_HOUR) * 60;

  for (let day = 0; day < days; day++) {
    for (let slot = 0; slot < tweetsPerDay; slot++) {
      const slotMinutes =
        tweetsPerDay === 1
          ? WINDOW_MINUTES / 2
          : (slot / (tweetsPerDay - 1)) * WINDOW_MINUTES;

      const jitterMinutes = (Math.random() - 0.5) * 20;
      const totalMinutes = WINDOW_START_HOUR * 60 + slotMinutes + jitterMinutes;
      const hours   = Math.floor(totalMinutes / 60);
      const minutes = Math.round(totalMinutes % 60);

      const date = new Date(base);
      date.setDate(base.getDate() + day);
      date.setHours(Math.min(hours, WINDOW_END_HOUR - 1), Math.max(0, Math.min(minutes, 59)), 0, 0);

      times.push(date);
    }
  }

  return times;
}

export function validateTweet(tweet: GeneratedTweet): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!tweet.text || tweet.text.length === 0) errors.push("Tweet vacío");
  if (tweet.text.length > 280) errors.push(`Excede 280 caracteres (${tweet.text.length})`);
  if (tweet.text.length < 10) warnings.push("Tweet muy corto");

  return { isValid: errors.length === 0, errors, warnings };
}
