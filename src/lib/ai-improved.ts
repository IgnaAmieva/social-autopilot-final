// src/lib/ai-improved.ts

import Anthropic from "@anthropic-ai/sdk";

function getAnthropicClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

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
): Promise<GeneratedTweet> {
  const { systemPrompt, niche, language = "es", evergreenOnly = false } = config;
  const toneDesc = TONE_PROMPTS[tone];

  // Build context block from account config
  const nicheContext = niche
    ? `\nNicho de la cuenta: "${niche}" — asegúrate de que el contenido sea relevante para esta audiencia.`
    : "";

  // If the account has a custom system_prompt, inject it as identity/voice block
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

  const rawText =
    message.content[0]?.type === "text" ? message.content[0].text.trim() : "";

  if (!rawText) {
    console.error(`[AI] Tweet ${index + 1} devolvió texto vacío. stop_reason=${message.stop_reason}`);
    throw new Error(`Claude devolvió texto vacío para tweet ${index + 1} (stop_reason: ${message.stop_reason})`);
  }

  // Quitar comillas envolventes si Claude las incluyó
  const text = rawText.replace(/^["'""«]|["'""»]$/g, "").trim();

  console.log(`[AI] Tweet ${index + 1} generado — tone=${tone}, chars=${text.length}`);
  return { text, tone, length: text.length };
}

export async function generateTweetsWithAIImproved(
  config: GenerateTweetsConfig
): Promise<GeneratedTweet[]> {
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

  // Distribute tones: first tweet uses baseTone, rest cycle through others
  const assignedTones: TweetTone[] = Array.from({ length: count }, (_, i) => {
    if (i === 0) return baseTone;
    const others = allTones.filter((t) => t !== baseTone);
    return others[(i - 1) % others.length];
  });

  const editorialConfig = { systemPrompt, niche, language, evergreenOnly };

  const tweets: GeneratedTweet[] = [];
  const batchSize = 5;

  for (let i = 0; i < count; i += batchSize) {
    const batch = assignedTones.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map((t, j) => generateSingleTweet(topic, t, i + j, editorialConfig))
    );
    tweets.push(...results);
  }

  return tweets;
}

/**
 * Distributes scheduled_time slots across N days starting from startDate.
 * Tweets are spread through a daily window (8:00 – 22:00) with slight jitter.
 *
 * @param days          Number of days to schedule over
 * @param tweetsPerDay  Number of tweets per day
 * @param startDate     First day to schedule (defaults to tomorrow)
 */
export function distributeScheduleTimes(
  days: number,
  tweetsPerDay: number,
  startDate?: Date
): Date[] {
  const times: Date[] = [];

  // Default start: tomorrow at 08:00 local time
  const base = startDate ?? (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(8, 0, 0, 0);
    return d;
  })();

  const WINDOW_START_HOUR = 8;   // 08:00
  const WINDOW_END_HOUR   = 22;  // 22:00
  const WINDOW_MINUTES    = (WINDOW_END_HOUR - WINDOW_START_HOUR) * 60; // 840 min

  for (let day = 0; day < days; day++) {
    for (let slot = 0; slot < tweetsPerDay; slot++) {
      // Even spacing within the daily window
      const slotMinutes =
        tweetsPerDay === 1
          ? WINDOW_MINUTES / 2 // single tweet at noon-ish
          : (slot / (tweetsPerDay - 1)) * WINDOW_MINUTES;

      // ±10 min jitter to feel natural
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
