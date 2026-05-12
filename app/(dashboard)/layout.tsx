import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { TooltipProvider } from "@/components/ui/tooltip";
import { isOnboardingCompleteInMetadata } from "@/lib/auth/onboarding";
import { getSupabaseAuthUser } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getSupabaseAuthUser();
  if (!user) {
    redirect("/sign-in");
  }
  if (!isOnboardingCompleteInMetadata(user.user_metadata)) {
    redirect("/onboarding");
  }

  return (
    <TooltipProvider>
      <DashboardShell>{children}</DashboardShell>
    </TooltipProvider>
  );
}
