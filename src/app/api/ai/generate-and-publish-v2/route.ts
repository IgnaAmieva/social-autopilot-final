import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  generateTweetsWithAIImproved,
  distributeScheduleTimes,
  validateTweet,
} from "@/lib/ai-improved";
import { createTypefullyDraft } from "@/lib/typefully";


interface Account {
  id: string;
  username: string;
  typefully_social_set_id: string | null;
}

/**
 * Assigns accounts to tweets using a greedy algorithm that enforces
 * a minimum 2-hour gap between consecutive tweets for the same account.
 */
function assignAccounts(scheduleTimes: Date[], accounts: Account[]): Account[] {
  const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
  const lastUsed = new Map<string, number>(); // accountId -> last scheduled timestamp

  return scheduleTimes.map((time, i) => {
    const ts = time.getTime();

    // Find the account with the longest idle time that satisfies the 2-hour gap
    let best: Account | null = null;
    let bestIdleTime = -1;

    for (const account of accounts) {
      const last = lastUsed.get(account.id) ?? -Infinity;
      const gap = ts - last;
      if (gap >= TWO_HOURS_MS && gap > bestIdleTime) {
        best = account;
        bestIdleTime = gap;
      }
    }

    // Fallback: no account satisfies the gap — pick least-recently-used
    if (!best) {
      best = accounts.reduce((lru, acc) => {
        const lruLast = lastUsed.get(lru.id) ?? -Infinity;
        const accLast = lastUsed.get(acc.id) ?? -Infinity;
        return accLast < lruLast ? acc : lru;
      }, accounts[i % accounts.length]);
    }

    lastUsed.set(best.id, ts);
    return best;
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { topic, tone = "casual", count = 5, publishNow = false, accountIds } = body;

    if (!topic) {
      return NextResponse.json({ error: "Topic required" }, { status: 400 });
    }
    if (count < 1 || count > 100) {
      return NextResponse.json({ error: "Count must be between 1 and 100" }, { status: 400 });
    }

    console.log(`[AI] Generating ${count} tweets about "${topic}"`);

    const supabase = getSupabaseAdmin();
    const tweets = await generateTweetsWithAIImproved({ topic, tone, count });
    const scheduleTimes = distributeScheduleTimes(tweets.length);

    // Fetch enabled accounts
    let query = supabase
      .from("accounts")
      .select("id, username, typefully_social_set_id")
      .eq("typefully_enabled", true);

    if (accountIds && accountIds.length > 0) {
      query = query.in("id", accountIds);
    }

    const { data: accounts, error: accountsError } = await query;

    if (accountsError || !accounts || accounts.length === 0) {
      return NextResponse.json({ error: "No enabled accounts found" }, { status: 400 });
    }

    console.log(`[DB] ${accounts.length} accounts — distributing ${tweets.length} tweets`);

    // Smart assignment: respect 2-hour gap per account
    const assignedAccounts = assignAccounts(scheduleTimes, accounts as Account[]);

    const publishedTweets = [];
    const failedTweets = [];

    for (let i = 0; i < tweets.length; i++) {
      const tweet = tweets[i];
      const scheduledTime = scheduleTimes[i];
      const account = assignedAccounts[i];

      try {
        const validation = validateTweet(tweet);
        if (!validation.isValid) {
          throw new Error(validation.errors.join("; "));
        }

        if (!account.typefully_social_set_id) {
          throw new Error(`Account @${account.username} has no Typefully social set ID`);
        }

        const publishAt = publishNow ? "now" : scheduledTime.toISOString();
        const draft = await createTypefullyDraft(
          account.typefully_social_set_id,
          tweet.text,
          publishAt
        );

        const { data: dbRecord } = await supabase
          .from("ai_generated_posts")
          .insert({
            account_id: account.id,
            topic,
            tone: tweet.tone,
            content: tweet.text,
            typefully_draft_id: draft.id,
            scheduled_time: scheduledTime.toISOString(),
            status: publishNow ? "published" : "scheduled",
          })
          .select("id")
          .single();

        publishedTweets.push({
          id: dbRecord?.id ?? `tweet-${i}`,
          text: tweet.text,
          tone: tweet.tone,
          scheduled_time: scheduledTime.toISOString(),
          status: publishNow ? ("published" as const) : ("scheduled" as const),
          account: account.username,
        });

        console.log(`[✓] Tweet ${i + 1}/${tweets.length} → @${account.username}`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[✗] Tweet ${i + 1} failed: ${msg}`);
        failedTweets.push({
          id: `failed-${i}`,
          text: tweet.text,
          tone: tweet.tone,
          scheduled_time: scheduledTime.toISOString(),
          status: "failed" as const,
          error: msg,
        });
      }
    }

    const firstError = failedTweets[0]?.error;
    return NextResponse.json({
      success: failedTweets.length === 0,
      tweetsGenerated: tweets.length,
      tweetsPublished: publishedTweets.length,
      tweetsFailed: failedTweets.length,
      tweets: [...publishedTweets, ...failedTweets],
      summary: `Generated ${tweets.length} tweets across ${accounts.length} accounts. Scheduled: ${publishedTweets.length}, Failed: ${failedTweets.length}.`,
      error: failedTweets.length > 0 ? firstError : undefined,
    });
  } catch (error) {
    console.error("[API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "/api/ai/generate-and-publish-v2",
  });
}
