import { createBrowserClient } from "@supabase/ssr";
import { supabaseAnonEnv } from "@/lib/supabase/env";

export function createSupabaseBrowserClient() {
  const { url, anonKey } = supabaseAnonEnv();
  return createBrowserClient(url, anonKey);
}
