import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isOnboardingCompleteInMetadata } from "@/lib/auth/onboarding";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const user = await currentUser();
  if (!user) {
    redirect("/sign-in");
  }
  if (isOnboardingCompleteInMetadata(user.publicMetadata)) {
    redirect("/");
  }

  return (
    <div className="flex flex-col gap-6">
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
