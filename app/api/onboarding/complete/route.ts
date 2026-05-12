import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Marks onboarding complete for the signed-in user via Supabase `user_metadata`.
 */
export async function POST() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ ok: false as const, error: "Not signed in." }, { status: 401 });
  }

  try {
    const existing =
      typeof user.user_metadata === "object" && user.user_metadata !== null
        ? { ...(user.user_metadata as Record<string, unknown>) }
        : {};
    const { error } = await supabase.auth.updateUser({
      data: {
        ...existing,
        onboardingComplete: true,
      },
    });
    if (error) {
      return NextResponse.json(
        { ok: false as const, error: "Could not save onboarding status." },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true as const });
  } catch {
    return NextResponse.json(
      { ok: false as const, error: "Could not save onboarding status." },
      { status: 500 },
    );
  }
}
