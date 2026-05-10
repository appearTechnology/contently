import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. Bypasses RLS — every caller MUST scope work by
 * the authenticated Clerk userId before issuing a query or storage call.
 *
 * All branding access in this app is server-only (Route Handlers / RSC), so
 * we use this client exclusively. RLS on the branding tables is kept enabled
 * as defense-in-depth in case the anon key is ever exposed to a browser.
 */
export function createSupabaseAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing Supabase credentials: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

/** Default branding bucket; overridable via env so tests/preview can isolate. */
export function brandingAssetsBucket(): string {
  return process.env.SUPABASE_BRANDING_BUCKET ?? "branding-assets";
}
