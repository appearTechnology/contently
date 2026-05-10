import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { shouldAllowOnboardingWithoutSession } from "@/lib/auth/onboarding-local-bypass";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
]);

const isApiRoute = createRouteMatcher(["/api(.*)"]);

export default clerkMiddleware(async (auth, request) => {
  if (isPublicRoute(request) || isApiRoute(request)) {
    return NextResponse.next();
  }

  if (
    request.nextUrl.pathname.startsWith("/onboarding") &&
    shouldAllowOnboardingWithoutSession(request.nextUrl.hostname)
  ) {
    return NextResponse.next();
  }

  await auth.protect();

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
