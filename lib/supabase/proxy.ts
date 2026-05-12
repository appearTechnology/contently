import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { trySupabaseAnonEnv } from "@/lib/supabase/env";

/**
 * Refreshes the Supabase session and forwards auth cookies on the response.
 * Call from root `proxy.ts` on every matched request (including `/api/*`).
 */
export async function updateSupabaseSession(request: NextRequest) {
  const creds = trySupabaseAnonEnv();
  let response = NextResponse.next({ request });

  if (!creds) {
    return response;
  }

  const supabase = createServerClient(creds.url, creds.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, responseHeaders) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        Object.entries(responseHeaders).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
      },
    },
  });

  await supabase.auth.getClaims();

  return response;
}
