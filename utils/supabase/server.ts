import { createServerClient } from "@supabase/ssr";
import { getSupabasePublicCredentials } from "@/utils/supabase/credentials";

type CookieStore = Awaited<ReturnType<typeof import("next/headers").cookies>>;

/**
 * Server Supabase client (Supabase Next.js SSR guide pattern).
 * Prefer `await cookies()` then pass the store, e.g. `createClient(await cookies())`.
 */
export function createClient(cookieStore: CookieStore) {
  const { url, key } = getSupabasePublicCredentials();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component — rely on root `proxy.ts` to refresh cookies.
        }
      },
    },
  });
}
