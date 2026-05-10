import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ClerkSignInPanel } from "@/components/clerk-sign-in-panel";

export default async function SignInPage() {
  const { userId } = await auth();
  if (userId) {
    redirect("/");
  }

  return <ClerkSignInPanel />;
}
