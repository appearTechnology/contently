/**
 * Lets `/onboarding` load without Clerk session checks during local UI work.
 *
 * Enabled when:
 * - `DISABLE_ONBOARDING_GUARD=1` (or `true` / `yes`) in any environment, or
 * - `NODE_ENV === "development"` and the request host is localhost / 127.0.0.1 / ::1
 *
 * Never matches production hosts unless the explicit env flag is set.
 */

function envGuardDisabled(): boolean {
  const v = process.env.DISABLE_ONBOARDING_GUARD?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function isLoopbackHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1";
}

/** Used by `proxy.ts` — hostname from the incoming request URL. */
export function shouldAllowOnboardingWithoutSession(hostname: string): boolean {
  if (envGuardDisabled()) return true;
  if (process.env.NODE_ENV !== "development") return false;
  return isLoopbackHost(hostname);
}

/** Used by the onboarding page — `host` header value (may include port). */
export function shouldSkipOnboardingPageGuards(hostHeader: string | null): boolean {
  if (envGuardDisabled()) return true;
  if (process.env.NODE_ENV !== "development") return false;
  const host = hostHeader?.split(":")[0]?.trim() ?? "";
  if (!host) return false;
  return isLoopbackHost(host);
}
