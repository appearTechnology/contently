import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { TooltipProvider } from "@/components/ui/tooltip";
import { isOnboardingCompleteInMetadata } from "@/lib/auth/onboarding";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await currentUser();
  if (!user) {
    redirect("/sign-in");
  }
  if (!isOnboardingCompleteInMetadata(user.publicMetadata)) {
    redirect("/onboarding");
  }

  return (
    <TooltipProvider>
      <DashboardShell>{children}</DashboardShell>
    </TooltipProvider>
  );
}
