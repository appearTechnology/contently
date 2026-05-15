import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  PASSWORD_RECOVERY_COOKIE,
  PASSWORD_RECOVERY_COOKIE_MAX_AGE_SECONDS,
} from "@/lib/auth/password-recovery";
import { supabaseAnonEnv } from "@/lib/supabase/env";

export const runtime = "nodejs";

function safeInternalPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeInternalPath(searchParams.get("next"));

  if (code) {
    const cookieStore = await cookies();
    const { url, anonKey } = supabaseAnonEnv();
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    });
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const response = NextResponse.redirect(`${origin}${next}`);
      if (next === "/auth/update-password") {
        response.cookies.set(PASSWORD_RECOVERY_COOKIE, "1", {
          httpOnly: true,
          maxAge: PASSWORD_RECOVERY_COOKIE_MAX_AGE_SECONDS,
          path: "/auth/update-password",
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
        });
      }
      return response;
    }
  }

  return NextResponse.redirect(`${origin}/sign-in?error=auth`);
}
