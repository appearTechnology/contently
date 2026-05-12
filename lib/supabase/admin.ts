import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. Bypasses RLS — every caller MUST scope work by
 * the authenticated Supabase Auth user id before issuing a query or storage call.
 *
 * All branding access in this app is server-only (Route Handlers / RSC), so
 * we use this client exclusively. RLS on the branding tables is kept enabled
 * as defense-in-depth in case the anon key is ever exposed to a browser.
 */
function resolveServiceRoleKey(): string {
  const raw =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SECRET_KEY ??
    "";
  return typeof raw === "string" ? raw.trim() : "";
}

function resolveSupabaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    ""
  ).trim();
}

/** e.g. https://supabase.com/dashboard/project/<ref>/settings/api */
export function supabaseDashboardApiSettingsUrl(): string | null {
  const url = resolveSupabaseUrl();
  if (!url) return null;
  try {
    const host = new URL(url).hostname;
    const m = /^([a-z0-9-]+)\.supabase\.co$/i.exec(host);
    if (!m?.[1]) return null;
    return `https://supabase.com/dashboard/project/${m[1]}/settings/api`;
  } catch {
    return null;
  }
}

/**
 * Returns a service-role client when URL + secret are configured; otherwise null.
 * Use for reads where an empty default is acceptable (e.g. branding view on /generate).
 */
export function tryCreateSupabaseAdminClient(): SupabaseClient | null {
  const url = resolveSupabaseUrl();
  const serviceKey = resolveServiceRoleKey();
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export function createSupabaseAdminClient(): SupabaseClient {
  const client = tryCreateSupabaseAdminClient();
  if (!client) {
    throw new Error(
      "Missing Supabase server credentials: set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and " +
        "SUPABASE_SERVICE_ROLE_KEY (legacy JWT) or SUPABASE_SECRET_KEY (sb_secret_…), " +
        "both from the same Supabase project → Dashboard → Settings → API.",
    );
  }
  return client;
}

/** Default branding bucket; overridable via env so tests/preview can isolate. */
export function brandingAssetsBucket(): string {
  return process.env.SUPABASE_BRANDING_BUCKET ?? "branding-assets";
}
