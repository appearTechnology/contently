import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ClerkSignUpPanel } from "@/components/clerk-sign-up-panel";

export default async function SignUpPage() {
  const { userId } = await auth();
  if (userId) {
    redirect("/");
  }

  return <ClerkSignUpPanel />;
}
