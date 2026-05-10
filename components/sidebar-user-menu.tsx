"use client";

import Image from "next/image";
import { SignOutButton, useUser } from "@clerk/nextjs";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function initialsFromUser(
  first: string | null | undefined,
  last: string | null | undefined,
  email: string | null | undefined,
): string {
  const f = first?.trim().charAt(0);
  const l = last?.trim().charAt(0);
  if (f && l) return (f + l).toUpperCase();
  if (f) return f.toUpperCase();
  const e = email?.trim().charAt(0);
  if (e) return e.toUpperCase();
  return "?";
}

export function SidebarUserMenu() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <div className="flex justify-start px-2 py-1.5">
        <Skeleton className="size-9 shrink-0 rounded-full" aria-hidden />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const name =
    user.fullName ||
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    "Account";
  const email = user.primaryEmailAddress?.emailAddress ?? "";
  const imageUrl = user.imageUrl;
  const initials = initialsFromUser(
    user.firstName,
    user.lastName,
    email || undefined,
  );

  return (
    <div className="flex justify-start px-2 py-1.5">
      <Popover>
        <PopoverTrigger
          className={cn(
            "ring-sidebar-border focus-visible:ring-sidebar-ring flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-sidebar-border bg-sidebar-accent outline-none transition-[box-shadow,transform] hover:opacity-95 focus-visible:ring-2 active:scale-[0.98]",
          )}
          aria-label="Open account menu"
        >
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt=""
              width={36}
              height={36}
              className="size-9 object-cover"
              unoptimized
              aria-hidden
            />
          ) : (
            <span className="text-sidebar-foreground text-xs font-semibold">
              {initials}
            </span>
          )}
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
          <SignOutButton redirectUrl="/sign-in">
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:bg-muted hover:text-destructive h-8 w-full justify-start gap-2 px-2 font-medium"
            >
              <LogOut className="size-4 shrink-0" aria-hidden />
              Log out
            </Button>
          </SignOutButton>
        </PopoverContent>
      </Popover>
    </div>
  );
}
