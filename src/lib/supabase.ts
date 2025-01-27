import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types for our database tables
export interface DBUser {
  id: string;
  username: string;
  color: string;
  created_at: string;
  last_seen: string;
}

export interface DBMessage {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  username: string;
  user_color: string;
} 