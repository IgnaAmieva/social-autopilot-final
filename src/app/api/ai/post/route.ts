// src/app/api/ai/posts/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let query = supabase
      .from('ai_generated_posts')
      .select(
        `
        *,
        accounts:account_id (
          username,
          display_name
        )
      `
      )
      .order('created_at', { ascending: false })
      .limit(100);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      posts: data,
      count: data?.length || 0,
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to fetch posts',
      },
      { status: 500 }
    );
  }
}