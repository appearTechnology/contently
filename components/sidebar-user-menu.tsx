"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function initialsFromUser(user: User): string {
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const full =
    (typeof meta?.full_name === "string" && meta.full_name) ||
    (typeof meta?.name === "string" && meta.name) ||
    "";
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]!.charAt(0) + parts[1]!.charAt(0)).toUpperCase();
  }
  if (parts.length === 1 && parts[0]!.length >= 2) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  const e = user.email?.trim().charAt(0);
  if (e) return e.toUpperCase();
  return "?";
}

function displayName(user: User): string {
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const full =
    (typeof meta?.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta?.name === "string" && meta.name.trim()) ||
    "";
  if (full) return full;
  return user.email ?? "Account";
}

export function SidebarUserMenu() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    void supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u);
      setLoaded(true);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  if (!loaded) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 group-data-[collapsible=icon]:justify-center">
        <Skeleton className="size-9 shrink-0 rounded-full" aria-hidden />
        <div className="min-w-0 flex-1 space-y-1 group-data-[collapsible=icon]:hidden">
          <Skeleton className="h-4 w-28" aria-hidden />
          <Skeleton className="h-3 w-36" aria-hidden />
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const name = displayName(user);
  const email = user.email ?? "";
  const initials = initialsFromUser(user);

  return (
    <div className="flex min-w-0 items-center gap-2 px-2 py-1.5 group-data-[collapsible=icon]:justify-center">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-sidebar-border bg-sidebar-accent text-sidebar-foreground text-xs font-semibold">
        {initials}
      </span>
      <span className="grid min-w-0 flex-1 leading-tight group-data-[collapsible=icon]:hidden">
        <span className="truncate text-sm font-medium text-sidebar-foreground">
          {name}
        </span>
        {email ? (
          <span className="truncate text-xs text-sidebar-foreground/70">
            {email}
          </span>
        ) : null}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-destructive size-8 shrink-0 group-data-[collapsible=icon]:hidden"
        onClick={() => void signOut()}
        aria-label="Log out"
      >
        <LogOut className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
