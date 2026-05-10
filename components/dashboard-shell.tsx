"use client";

import type { ReactNode } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="bg-background sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="font-heading truncate text-sm font-semibold">
              Ad creative studio
            </span>
            <span className="text-muted-foreground hidden truncate text-xs sm:block">
              Paid-social stills from product photos via AI Gateway
            </span>
          </div>
        </header>
        <main className="flex flex-1 flex-col overflow-auto">
          <div className="flex flex-1 flex-col px-4 pt-8 pb-10 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
