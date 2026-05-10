import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Marks onboarding complete for the signed-in user.
 * Implemented as a route handler (not a Server Action) so responses stay JSON
 * and never hit Clerk’s middleware 401 empty-body path for Server Actions.
 */
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ ok: false as const, error: "Not signed in." }, { status: 401 });
  }

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const existing =
      typeof user.publicMetadata === "object" && user.publicMetadata !== null
        ? { ...(user.publicMetadata as Record<string, unknown>) }
        : {};
    await client.users.updateUserMetadata(userId, {
      publicMetadata: {
        ...existing,
        onboardingComplete: true,
      },
    });
    return NextResponse.json({ ok: true as const });
  } catch {
    return NextResponse.json(
      { ok: false as const, error: "Could not save onboarding status." },
      { status: 500 },
    );
  }
}
