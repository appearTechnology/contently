/** Supabase Auth `user_metadata.onboardingComplete` set after URL onboarding. */
export function isOnboardingCompleteInMetadata(userMetadata: unknown): boolean {
  if (!userMetadata || typeof userMetadata !== "object") return false;
  return (userMetadata as Record<string, unknown>).onboardingComplete === true;
}
