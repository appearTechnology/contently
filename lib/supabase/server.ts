import { auth } from "@clerk/nextjs/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Per-request Supabase client that forwards the signed-in user's Clerk session
 * token. Use this when you want RLS policies (`auth.jwt() ->> 'sub'`) to apply.
 *
 * Requires Clerk Native Third-Party Auth to be configured in the Supabase
 * Dashboard (Authentication → Third-Party Auth → Clerk). Without that
 * configuration, anon-token requests will be rejected by RLS.
 *
 * For the current server-only access pattern in this app, prefer
 * `createSupabaseAdminClient()` from `lib/supabase/admin.ts` and scope every
 * call by Clerk userId in code. This helper is exported for future use cases
 * (e.g. browser → Supabase direct reads).
 */
export function createSupabaseServerClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase credentials: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    accessToken: async () => {
      const { getToken } = await auth();
      return (await getToken()) ?? null;
    },
  });
}
