"use client";

import { SignIn } from "@clerk/nextjs";

/**
 * Client-mounted SignIn with path routing for App Router catch-all
 * `[[...sign-in]]`.
 */
export function ClerkSignInPanel() {
  return (
    <SignIn
      path="/sign-in"
      routing="path"
      signUpUrl="/sign-up"
      forceRedirectUrl="/"
      fallbackRedirectUrl="/"
    />
  );
}
