import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  generateTweetsWithAIImproved,
  distributeScheduleTimes,
  validateTweet,
} from "@/lib/ai-improved";
import { createTypefullyDraft } from "@/lib/typefully";

interface AccountRow {
  id: string;
  username: string;
  typefully_api_key: string | null;
  typefully_social_set_id: number | null;
  niche: string | null;
  system_prompt: string | null;
  tone: string | null;
  language: string | null;
  evergreen_only: boolean;
}

function stripAt(username: string) {
  return username.replace(/^@+/, "");
}

/**
 * Assigns accounts to tweet slots using a greedy algorithm that enforces
 * a minimum 2-hour gap between consecutive tweets for the same account.
 */
function assignAccounts(
  scheduleTimes: Date[],
  accounts: AccountRow[]
): AccountRow[] {
  const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
  const lastUsed = new Map<string, number>();

  return scheduleTimes.map((time, i) => {
    const ts = time.getTime();
    let best: AccountRow | null = null;
    let bestIdleTime = -1;

    for (const account of accounts) {
      const last = lastUsed.get(account.id) ?? -Infinity;
      const gap = ts - last;
      if (gap >= TWO_HOURS_MS && gap > bestIdleTime) {
        best = account;
        bestIdleTime = gap;
      }
    }

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
    const {
      topic,
      days = 1,
      tweetsPerDay = 5,
      publishNow = false,
      evergreenOnly,
      startDate,
      accountId,
    } = body;

    if (!topic?.trim()) {
      return NextResponse.json({ error: "El tema es obligatorio" }, { status: 400 });
    }
    if (days < 1 || days > 90) {
      return NextResponse.json({ error: "Los días deben estar entre 1 y 90" }, { status: 400 });
    }
    if (tweetsPerDay < 1 || tweetsPerDay > 20) {
      return NextResponse.json({ error: "Tweets por día debe estar entre 1 y 20" }, { status: 400 });
    }

    const totalTweets = days * tweetsPerDay;
    const supabase = getSupabaseAdmin();

    // ── STEP: Fetch accounts ────────────────────────────────────────────────
    console.log(`[STEP] Fetch accounts — accountId=${accountId ?? "all"}, topic="${topic}"`);

    let query = supabase
      .from("accounts")
      .select(
        "id, username, typefully_api_key, typefully_social_set_id, niche, system_prompt, tone, language, evergreen_only"
      )
      .eq("enabled", true);

    if (accountId) {
      query = query.eq("id", accountId);
    }

    const { data: accounts, error: accountsError } = await query;

    if (accountsError) {
      console.error("[STEP] Fetch accounts — DB error:", JSON.stringify(accountsError));
      return NextResponse.json(
        { error: `Error al consultar cuentas: ${accountsError.message}` },
        { status: 500 }
      );
    }

    if (!accounts || accounts.length === 0) {
      console.error("[STEP] Fetch accounts — no enabled accounts found");
      return NextResponse.json(
        { error: "No se encontraron cuentas habilitadas (enabled = true)" },
        { status: 400 }
      );
    }

    console.log(`[STEP] Fetch accounts — encontradas: ${accounts.map((a) => `@${stripAt(a.username)}`).join(", ")}`);

    const missingCreds = accounts.filter(
      (a) => !a.typefully_api_key || !a.typefully_social_set_id
    );
    if (missingCreds.length > 0) {
      const names = missingCreds.map((a) => `@${stripAt(a.username)}`).join(", ");
      console.error(`[STEP] Fetch accounts — credenciales faltantes: ${names}`);
      return NextResponse.json(
        {
          error: `Las siguientes cuentas no tienen credenciales de Typefully configuradas: ${names}. Configúralas en /accounts.`,
        },
        { status: 400 }
      );
    }

    const primaryAccount = accounts[0];
    const resolvedEvergreen =
      evergreenOnly !== undefined ? evergreenOnly : primaryAccount.evergreen_only;

    // ── STEP: Create batch ──────────────────────────────────────────────────
    console.log(`[STEP] Create batch — ${totalTweets} tweets (${days}d × ${tweetsPerDay}/d)`);

    const { data: batch, error: batchError } = await supabase
      .from("content_batches")
      .insert({
        account_id: primaryAccount.id,
        topic: topic.trim(),
        start_date: startDate ?? new Date(Date.now() + 86400000).toISOString().split("T")[0],
        days,
        tweets_per_day: tweetsPerDay,
        total_tweets: totalTweets,
        status: "generating",
      })
      .select("id")
      .single();

    if (batchError) {
      console.error("[STEP] Create batch — DB error:", JSON.stringify(batchError));
    } else {
      console.log(`[STEP] Create batch — batch_id=${batch?.id}`);
    }

    const batchId = batch?.id ?? null;

    // ── STEP: Generate tweets with AI ───────────────────────────────────────
    console.log(`[STEP] Generate tweets with AI — count=${totalTweets}, tone=${primaryAccount.tone ?? "casual"}, lang=${primaryAccount.language ?? "es"}`);

    let tweets;
    try {
      tweets = await generateTweetsWithAIImproved({
        topic: topic.trim(),
        count: totalTweets,
        tone: primaryAccount.tone ?? "casual",
        systemPrompt: primaryAccount.system_prompt,
        niche: primaryAccount.niche,
        language: primaryAccount.language ?? "es",
        evergreenOnly: resolvedEvergreen,
      });
    } catch (aiError) {
      const msg = aiError instanceof Error ? aiError.message : String(aiError);
      console.error(`[STEP] Generate tweets with AI — ERROR: ${msg}`);
      if (batchId) {
        await supabase
          .from("content_batches")
          .update({ status: "failed", error_message: `Claude error: ${msg}` })
          .eq("id", batchId);
      }
      return NextResponse.json(
        { success: false, error: `Error al generar tweets con Claude: ${msg}` },
        { status: 500 }
      );
    }

    console.log(`[STEP] Generate tweets with AI — generados: ${tweets.length} tweets`);
    for (let i = 0; i < tweets.length; i++) {
      console.log(`  Tweet ${i + 1}: [${tweets[i].tone}] "${tweets[i].text.slice(0, 60)}..." (${tweets[i].text.length} chars)`);
    }

    // ── STEP: Build schedule ────────────────────────────────────────────────
    const parsedStart = startDate ? new Date(startDate) : undefined;
    const scheduleTimes = distributeScheduleTimes(days, tweetsPerDay, parsedStart);
    const assignedAccounts = assignAccounts(scheduleTimes, accounts as AccountRow[]);

    const publishedTweets: unknown[] = [];
    const failedTweets: unknown[] = [];

    for (let i = 0; i < tweets.length; i++) {
      const tweet = tweets[i];
      const scheduledTime = scheduleTimes[i];
      const account = assignedAccounts[i];

      console.log(`\n[STEP] Processing tweet ${i + 1}/${tweets.length} → @${stripAt(account.username)}`);

      try {
        // ── STEP: Validate tweet ──────────────────────────────────────────
        console.log(`[STEP] Validate tweet ${i + 1} — length=${tweet.text.length}`);
        const validation = validateTweet(tweet);
        if (!validation.isValid) {
          throw new Error(`Validación fallida: ${validation.errors.join("; ")}`);
        }
        if (validation.warnings.length > 0) {
          console.warn(`[STEP] Validate tweet ${i + 1} — warnings: ${validation.warnings.join("; ")}`);
        }

        const publishAt = publishNow ? "now" : scheduledTime.toISOString();
        console.log(`[STEP] Validate tweet ${i + 1} — OK, publishAt=${publishAt}`);

        // ── STEP: Create Typefully draft ──────────────────────────────────
        console.log(`[STEP] Create Typefully draft — account=@${stripAt(account.username)} id=${account.id} socialSetId=${account.typefully_social_set_id}`);
        const draft = await createTypefullyDraft(
          account.typefully_api_key!,
          String(account.typefully_social_set_id!),
          tweet.text,
          publishAt,
          { username: account.username, accountId: account.id }
        );
        console.log(`[STEP] Create Typefully draft — OK, draft.id=${draft.id}`);

        // ── STEP: Insert ai_generated_posts ───────────────────────────────
        console.log(`[STEP] Insert ai_generated_posts — tweet ${i + 1}`);
        const { data: dbRecord, error: insertError } = await supabase
          .from("ai_generated_posts")
          .insert({
            account_id: account.id,
            topic: topic.trim(),
            tone: tweet.tone,
            content: tweet.text,
            typefully_draft_id: draft.id,
            scheduled_time: scheduledTime.toISOString(),
            status: publishNow ? "published" : "scheduled",
            batch_id: batchId,
          })
          .select("id")
          .single();

        if (insertError) {
          console.error(`[STEP] Insert ai_generated_posts — DB error: ${JSON.stringify(insertError)}`);
          throw new Error(`DB insert error: ${insertError.message}`);
        }

        console.log(`[STEP] Insert ai_generated_posts — OK, record_id=${dbRecord?.id}`);

        publishedTweets.push({
          id: dbRecord?.id ?? `tweet-${i}`,
          text: tweet.text,
          tone: tweet.tone,
          scheduled_time: scheduledTime.toISOString(),
          status: publishNow ? "published" : "scheduled",
          account: stripAt(account.username),
        });

        console.log(`[✓] Tweet ${i + 1}/${tweets.length} programado → @${stripAt(account.username)}`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[✗] Tweet ${i + 1}/${tweets.length} FALLÓ: ${msg}`);
        failedTweets.push({
          id: `failed-${i}`,
          text: tweet.text,
          tone: tweet.tone,
          scheduled_time: scheduledTime.toISOString(),
          status: "failed",
          account: stripAt(account.username),
          error: msg,
        });
      }
    }

    // ── STEP: Update batch ──────────────────────────────────────────────────
    console.log(`\n[STEP] Update batch — scheduled=${publishedTweets.length}, failed=${failedTweets.length}`);
    if (batchId) {
      const { error: batchUpdateError } = await supabase
        .from("content_batches")
        .update({
          status: failedTweets.length === 0 ? "scheduled" : "failed",
          error_message:
            failedTweets.length > 0
              ? `${failedTweets.length} de ${tweets.length} tweets fallaron`
              : null,
        })
        .eq("id", batchId);

      if (batchUpdateError) {
        console.error("[STEP] Update batch — DB error:", JSON.stringify(batchUpdateError));
      }
    }

    const displayUsername = `@${stripAt(primaryAccount.username)}`;
    const allTweets = [...publishedTweets, ...failedTweets];

    console.log(`[STEP] Done — ${publishedTweets.length} programados, ${failedTweets.length} fallidos para ${displayUsername}`);

    return NextResponse.json({
      success: failedTweets.length === 0,
      batchId,
      tweetsGenerated: tweets.length,
      tweetsScheduled: publishedTweets.length,
      tweetsFailed: failedTweets.length,
      tweets: allTweets,
      summary: `${publishedTweets.length} tweets programados en ${days} día${days > 1 ? "s" : ""} para ${displayUsername}.${failedTweets.length > 0 ? ` ${failedTweets.length} fallaron.` : ""}`,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[API] Error no capturado:", msg);
    if (error instanceof Error && error.stack) {
      console.error("[API] Stack:", error.stack);
    }
    return NextResponse.json(
      {
        success: false,
        error: msg,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ status: "ok", endpoint: "/api/ai/generate-and-publish-v2" });
}
