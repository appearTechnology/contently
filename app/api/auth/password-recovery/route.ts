import { NextResponse } from "next/server";
import { PASSWORD_RECOVERY_COOKIE } from "@/lib/auth/password-recovery";

export const runtime = "nodejs";

export async function DELETE() {
  const response = NextResponse.json({ ok: true as const });
  response.cookies.set(PASSWORD_RECOVERY_COOKIE, "", {
    maxAge: 0,
    path: "/auth/update-password",
  });
  return response;
}

