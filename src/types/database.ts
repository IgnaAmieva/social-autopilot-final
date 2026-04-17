// src/types/database.ts

export interface Account {
  id: string;
  username: string;

  // Typefully — per-account credentials
  typefully_api_key: string | null;
  typefully_social_set_id: number | null;

  // Account status
  enabled: boolean;

  // Editorial configuration — per-account
  niche: string | null;
  subniche: string | null;
  system_prompt: string | null;
  tone: string | null;
  language: string | null;
  evergreen_only: boolean;
  tweets_per_day_default: number;

  created_at: string;
}

export interface AIGeneratedPost {
  id: string;
  account_id: string;
  content: string;
  topic: string | null;
  tone: string | null;
  status: "draft" | "scheduled" | "publishing" | "published" | "failed";
  scheduled_time: string | null;
  published_at: string | null;
  typefully_draft_id: string | null;
  batch_id: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContentBatch {
  id: string;
  account_id: string;
  topic: string;
  start_date: string;
  days: number;
  tweets_per_day: number;
  total_tweets: number;
  status: "pending" | "generating" | "scheduled" | "completed" | "failed";
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

// Legacy table — kept for backwards compatibility, not used in v2 flow
export interface Post {
  id: string;
  account_id: string;
  content: string;
  status: "draft" | "scheduled" | "publishing" | "published" | "failed";
  scheduled_at: string | null;
  published_at: string | null;
  platform_post_id: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}