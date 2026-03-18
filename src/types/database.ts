// src/types/database.ts

export interface Account {
  id: string;
  platform: string;
  platform_user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  
  // NUEVOS - Typefully
  typefully_social_set_id: string | null;
  typefully_account_label: string | null;
  typefully_enabled: boolean;
  created_at_typefully: string | null;
  
  created_at: string;
  updated_at: string;
}

export interface AIGeneratedPost {
  id: string;
  account_id: string;
  content: string;
  topic: string | null;
  status: 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';
  scheduled_at: string | null;
  published_at: string | null;
  typefully_draft_id: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface Post {
  id: string;
  account_id: string;
  content: string;
  status: 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';
  scheduled_at: string | null;
  published_at: string | null;
  platform_post_id: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}