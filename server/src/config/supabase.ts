import { createClient } from '@supabase/supabase-js';
import { config } from './env';

if (!config.supabase.url || !config.supabase.anonKey) {
  console.warn('Supabase credentials not configured. Google OAuth will not work.');
}

export const supabase = createClient(
  config.supabase.url,
  config.supabase.anonKey
);
