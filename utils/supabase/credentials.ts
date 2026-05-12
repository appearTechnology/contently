import { supabaseAnonEnv } from "@/lib/supabase/env";

/** URL + public client key for `@supabase/ssr` (publishable or anon JWT). */
export function getSupabasePublicCredentials(): { url: string; key: string } {
  const { url, anonKey: key } = supabaseAnonEnv();
  return { url, key };
}
