import Anthropic from "@anthropic-ai/sdk";

function getAnthropicClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

export type TweetTone = "casual" | "professional" | "humorous" | "inspiracional" | "educativo" | "provocativo";

export interface GeneratedTweet {
  text: string;
  tone: TweetTone;
  length: number;
}

const TONE_PROMPTS: Record<TweetTone, string> = {
  casual:        "Tono amigable y conversacional, como hablarle a un amigo. Natural, sin formalismos.",
  professional:  "Tono formal y profesional. Autoridad, credibilidad. Sin jerga.",
  humorous:      "Tono divertido y con humor. Usa ingenio, ironía sutil o referencias pop. Que haga sonreír.",
  inspiracional: "Tono motivador y positivo. Que inspire acción o reflexión.",
  educativo:     "Tono informativo. Enseña algo útil o un dato curioso sobre el tema.",
  provocativo:   "Tono audaz, desafiante. Cuestiona lo establecido. Genera debate.",
};

async function generateSingleTweet(topic: string, tone: TweetTone, index: number): Promise<GeneratedTweet> {
  const toneDesc = TONE_PROMPTS[tone];

  const prompt = `Genera un tweet en ESPAÑOL sobre: "${topic}"

Tono: ${tone.toUpperCase()} — ${toneDesc}
Tweet número ${index + 1}, hazlo ÚNICO y diferente a los anteriores.

Reglas estrictas:
- Máximo 260 caracteres (deja margen)
- Incluye 1-2 hashtags relevantes en español
- Incluye 1-2 emojis apropiados
- Contenido auténtico y atractivo
- Sin comillas al inicio o final
- SOLO devuelve el tweet, sin explicaciones ni texto adicional`;

  const message = await getAnthropicClient().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 120,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text.trim() : "";
  return { text, tone, length: text.length };
}

export async function generateTweetsWithAIImproved(config: {
  topic: string;
  count?: number;
  tone?: string;
}): Promise<GeneratedTweet[]> {
  const { topic, count = 5, tone = "casual" } = config;

  const tones: TweetTone[] = ["casual", "professional", "humorous", "inspiracional", "educativo", "provocativo"];
  const baseTone = tones.includes(tone as TweetTone) ? (tone as TweetTone) : "casual";

  // Distribute tones evenly, starting with the selected base tone
  const assignedTones: TweetTone[] = Array.from({ length: count }, (_, i) => {
    if (i === 0) return baseTone;
    const otherTones = tones.filter(t => t !== baseTone);
    return otherTones[(i - 1) % otherTones.length];
  });

  // Generate in batches of 5 (parallel within each batch)
  const tweets: GeneratedTweet[] = [];
  const batchSize = 5;

  for (let i = 0; i < count; i += batchSize) {
    const batch = assignedTones.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map((t, j) => generateSingleTweet(topic, t, i + j))
    );
    tweets.push(...results);
  }

  return tweets;
}

export function distributeScheduleTimes(count: number): Date[] {
  const times: Date[] = [];
  const now = new Date();
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  const baseInterval = TWENTY_FOUR_HOURS / count;
  const minInterval = 20 * 60 * 1000; // 20 min minimum

  for (let i = 0; i < count; i++) {
    const interval = Math.max(minInterval, baseInterval * (0.85 + Math.random() * 0.3));
    const jitter = Math.random() * 5 * 60 * 1000; // ±5 min
    times.push(new Date(now.getTime() + i * interval + jitter));
  }

  return times;
}

export function validateTweet(tweet: GeneratedTweet): { isValid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!tweet.text || tweet.text.length === 0) errors.push("Tweet vacío");
  if (tweet.text.length > 280) errors.push(`Excede 280 caracteres (${tweet.text.length})`);
  if (tweet.text.length < 10) warnings.push("Tweet muy corto");

  return { isValid: errors.length === 0, errors, warnings };
}

export function groupTweetsForPublication(tweets: GeneratedTweet[], times: Date[]) {
  void tweets; void times;
  return [];
}
