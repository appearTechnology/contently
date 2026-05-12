import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicCredentials } from "@/utils/supabase/credentials";

/** Browser Supabase client (Supabase Next.js SSR guide pattern). */
export function createClient() {
  const { url, key } = getSupabasePublicCredentials();
  return createBrowserClient(url, key);
}
