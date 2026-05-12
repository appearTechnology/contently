import { type NextRequest } from "next/server";
import { updateSupabaseSession } from "@/lib/supabase/proxy";

/**
 * Refreshes auth cookies on each request (Supabase “middleware” guide equivalent).
 * This app uses root `proxy.ts` → `updateSupabaseSession`; this export keeps the
 * same `createClient(request)` name as the official template.
 *
 * Official snippets often omit `getUser()` here; our shared helper calls
 * `getClaims()` so the session stays fresh.
 */
export async function createClient(request: NextRequest) {
  return updateSupabaseSession(request);
}
