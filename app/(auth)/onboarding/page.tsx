import { currentUser } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isOnboardingCompleteInMetadata } from "@/lib/auth/onboarding";
import { shouldSkipOnboardingPageGuards } from "@/lib/auth/onboarding-local-bypass";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const h = await headers();
  const host =
    h.get("x-forwarded-host")?.split(",")[0]?.trim() ?? h.get("host") ?? null;
  const guardOff = shouldSkipOnboardingPageGuards(host);

  const user = await currentUser();
  if (!guardOff) {
    if (!user) {
      redirect("/sign-in");
    }
    if (isOnboardingCompleteInMetadata(user.publicMetadata)) {
      redirect("/");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {guardOff ? (
        <Alert variant="default">
          <AlertTitle>Onboarding auth bypass</AlertTitle>
          <AlertDescription>
            Local dev: sign-in and “already completed” redirects are off so
            you can edit this screen. Form actions still need a real session where
            Clerk/Supabase apply. Set{" "}
            <code className="font-mono text-xs">DISABLE_ONBOARDING_GUARD=1</code> to
            force this on non-localhost dev hosts.
          </AlertDescription>
        </Alert>
      ) : null}
      <Card className="border-none bg-transparent shadow-none">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="font-heading text-2xl tracking-tight">
            Set up your brand
          </CardTitle>
          <CardDescription className="text-base leading-relaxed">
            One quick step — then you are in the studio with branding ready to
            use for generations.
          </CardDescription>
        </CardHeader>
      </Card>
      <OnboardingForm />
    </div>
  );
}
