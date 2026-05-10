/** Clerk `publicMetadata` flag set after URL onboarding. */
export function isOnboardingCompleteInMetadata(publicMetadata: unknown): boolean {
  if (!publicMetadata || typeof publicMetadata !== "object") return false;
  return (publicMetadata as Record<string, unknown>).onboardingComplete === true;
}
