// src/app/api/ai/generate-and-publish/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateTweetsWithAI } from '@/lib/ai';
import { createTypefullyDraft } from '@/lib/typefully';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface RequestBody {
  topic: string;
  tone?: 'funny' | 'serious' | 'informative' | 'mixed';
  publishNow?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    const { topic, tone = 'mixed', publishNow = true } = body;

    if (!topic) {
      return NextResponse.json(
        { error: 'Topic is required' },
        { status: 400 }
      );
    }

    // 1️⃣ Obtener todas las cuentas conectadas
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('*')
      .eq('typefully_enabled', true)
      .limit(20);

    if (accountsError || !accounts || accounts.length === 0) {
      return NextResponse.json(
        { error: 'No accounts found or database error' },
        { status: 400 }
      );
    }

    console.log(`Found ${accounts.length} accounts`);

    // 2️⃣ Generar tweets con IA
    console.log('Generating tweets with AI...');
    const tweets = await generateTweetsWithAI({
      topic,
      count: accounts.length,
      tone,
    });

    if (tweets.length < accounts.length) {
      console.warn(
        `Generated ${tweets.length} tweets, but have ${accounts.length} accounts`
      );
    }

    // 3️⃣ Publicar en Typefully (distribuir por cuenta)
    const publishedPosts = [];
    const errors = [];

    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i];
      const tweet = tweets[i] || tweets[tweets.length - 1]; // Usar último si se acaban

      if (!account.typefully_social_set_id) {
        errors.push({
          account: account.username,
          error: 'No Typefully social set ID',
        });
        continue;
      }

      try {
        // Calcular hora de publicación escalonada
        const now = new Date();
        const totalMinutes = 24 * 60; // 24 horas
        const interval = Math.floor(totalMinutes / accounts.length);
        const delayMinutes = interval * i + Math.random() * 10; // Agregar jitter
        const scheduledAt = new Date(now.getTime() + delayMinutes * 60000);

        // Crear draft en Typefully
        const draft = await createTypefullyDraft(
          account.typefully_social_set_id,
          tweet,
          publishNow ? 'now' : scheduledAt.toISOString()
        );

        // Guardar en DB
        const { error: insertError } = await supabase
          .from('ai_generated_posts')
          .insert({
            account_id: account.id,
            content: tweet,
            topic,
            status: publishNow ? 'publishing' : 'scheduled',
            scheduled_at: publishNow ? null : scheduledAt,
            typefully_draft_id: draft.id,
          });

        if (insertError) {
          errors.push({
            account: account.username,
            error: insertError.message,
          });
        } else {
          publishedPosts.push({
            account: account.username,
            tweet,
            scheduledAt: publishNow ? 'now' : scheduledAt,
            draftId: draft.id,
          });
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        errors.push({
          account: account.username,
          error: errorMessage,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Generated and ${
        publishNow ? 'published' : 'scheduled'
      } ${publishedPosts.length} posts`,
      posts: publishedPosts,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to generate tweets',
      },
      { status: 500 }
    );
  }
}