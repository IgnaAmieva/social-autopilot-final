// src/lib/ai.ts

import Anthropic from "@anthropic-ai/sdk";

function getAnthropicClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

interface GenerateTweetsOptions {
  topic: string;
  count?: number;
  tone?: 'funny' | 'serious' | 'informative' | 'mixed';
  style?: string;
}

export async function generateTweetsWithAI(
  options: GenerateTweetsOptions
): Promise<string[]> {
  const { topic, count = 1, tone = 'mixed', style = 'engaging' } = options;

  const prompt = `Generate ${count} unique, creative Twitter posts about: "${topic}"

Requirements:
- Each tweet must be under 280 characters
- Tone: ${tone}
- Style: ${style}
- Make them diverse and interesting
- NO hashtags
- NO duplicates

Return ONLY the tweets, one per line, numbered 1-${count}.`;

  const message = await getAnthropicClient().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";

  const tweets = text
    .split('\n')
    .filter((line) => line.match(/^\d+\./))
    .map((line) => line.replace(/^\d+\.\s*/, '').trim())
    .filter((tweet) => tweet.length > 0 && tweet.length <= 280);

  return tweets.length > 0 ? tweets : [text.substring(0, 280)];
}