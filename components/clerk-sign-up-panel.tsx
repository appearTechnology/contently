"use client";

import { SignUp } from "@clerk/nextjs";

/**
 * Client-mounted SignUp with path routing for App Router catch-all
 * `[[...sign-up]]`. Omitting `path` / `routing` here can break Clerk’s
 * Frontend API flows (including `POST /client/sign_ups`).
 */
export function ClerkSignUpPanel() {
  return (
    <SignUp
      path="/sign-up"
      routing="path"
      signInUrl="/sign-in"
      forceRedirectUrl="/onboarding"
      fallbackRedirectUrl="/onboarding"
    />
  );
}
