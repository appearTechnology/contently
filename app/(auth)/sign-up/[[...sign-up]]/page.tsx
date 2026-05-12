import { redirect } from "next/navigation";
import { SignUpPanel } from "@/components/sign-up-panel";
import { getSupabaseAuthUser } from "@/lib/supabase/server";

export default async function SignUpPage() {
  const user = await getSupabaseAuthUser();
  if (user) {
    redirect("/");
  }

  return <SignUpPanel />;
}
