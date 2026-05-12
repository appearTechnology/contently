"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
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
      <div className="flex justify-start px-2 py-1.5">
        <Skeleton className="size-9 shrink-0 rounded-full" aria-hidden />
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
    <div className="flex justify-start px-2 py-1.5">
      <Popover>
        <PopoverTrigger
          className={cn(
            "ring-sidebar-border focus-visible:ring-sidebar-ring flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-sidebar-border bg-sidebar-accent outline-none transition-[box-shadow,transform] hover:opacity-95 focus-visible:ring-2 active:scale-[0.98]",
          )}
          aria-label="Open account menu"
        >
          <span className="text-sidebar-foreground text-xs font-semibold">
            {initials}
          </span>
        </PopoverTrigger>
        <PopoverContent
          side="inline-end"
          align="end"
          sideOffset={8}
          className="w-56 p-2"
        >
          <div className="border-border mb-2 border-b px-1 pb-2">
            <p className="truncate text-sm font-medium">{name}</p>
            {email ? (
              <p className="text-muted-foreground truncate text-xs">{email}</p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            className="text-destructive hover:bg-muted hover:text-destructive h-8 w-full justify-start gap-2 px-2 font-medium"
            onClick={() => void signOut()}
          >
            <LogOut className="size-4 shrink-0" aria-hidden />
            Log out
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
