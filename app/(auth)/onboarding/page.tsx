import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { isOnboardingCompleteInMetadata } from "@/lib/auth/onboarding";
import { shouldSkipOnboardingPageGuards } from "@/lib/auth/onboarding-local-bypass";
import { getSupabaseAuthUser } from "@/lib/supabase/server";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const h = await headers();
  const host =
    h.get("x-forwarded-host")?.split(",")[0]?.trim() ?? h.get("host") ?? null;
  const guardOff = shouldSkipOnboardingPageGuards(host);

  const user = await getSupabaseAuthUser();
  if (!guardOff) {
    if (!user) {
      redirect("/sign-in");
    }
    if (isOnboardingCompleteInMetadata(user.user_metadata)) {
      redirect("/");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {guardOff ? (
        <Alert variant="default">
          <AlertTitle>Onboarding auth bypass</AlertTitle>
          <AlertDescription>
            Local dev: sign-in and “already completed” redirects are off so you
            can edit this screen. Form actions still need a real Supabase
            session. Set{" "}
            <code className="font-mono text-xs">DISABLE_ONBOARDING_GUARD=1</code>{" "}
            to force this on non-localhost dev hosts.
          </AlertDescription>
        </Alert>
      ) : null}
      <header className="space-y-2">
        <h1 className="font-heading text-2xl tracking-tight">Set up your brand</h1>
        <p className="text-muted-foreground text-base leading-relaxed">
          Let&apos;s fetch your brand&apos;s DNA, including logo, colours, fonts,
          etc.
        </p>
      </header>
      <OnboardingForm />
    </div>
  );
}
