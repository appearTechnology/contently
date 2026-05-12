import { redirect } from "next/navigation";
import { SignInPanel } from "@/components/sign-in-panel";
import { getSupabaseAuthUser } from "@/lib/supabase/server";

export default async function SignInPage() {
  const user = await getSupabaseAuthUser();
  if (user) {
    redirect("/");
  }

  return <SignInPanel />;
}
