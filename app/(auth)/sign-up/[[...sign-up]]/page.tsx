import { auth } from "@clerk/nextjs/server";
import { SignUp } from "@clerk/nextjs";
import { redirect } from "next/navigation";

export default async function SignUpPage() {
  const { userId } = await auth();
  if (userId) {
    redirect("/");
  }

  return (
    <SignUp
      signInUrl="/sign-in"
      forceRedirectUrl="/onboarding"
      fallbackRedirectUrl="/onboarding"
    />
  );
}
