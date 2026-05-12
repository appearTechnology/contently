import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { supabaseAnonEnv } from "@/lib/supabase/env";

/**
 * Per-request Supabase client with the user session from cookies.
 * Use `getUser()` for authorization; do not trust `getSession()` alone for gating.
 */
export async function getSupabaseServerClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = supabaseAnonEnv();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Cookie writes can fail outside a Server Action / Route Handler; `proxy.ts`
          // refreshes the session for navigations.
        }
      },
    },
  });
}

export async function getSupabaseAuthUser(): Promise<User | null> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

export async function getAuthenticatedUserId(): Promise<string | null> {
  const user = await getSupabaseAuthUser();
  return user?.id ?? null;
}
