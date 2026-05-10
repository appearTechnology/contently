"use client";

import Image from "next/image";
import { SignOutButton, useUser } from "@clerk/nextjs";
import { LogOut } from "lucide-react";
import { Popover } from "@base-ui/react/popover";
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
        <div
          className="bg-sidebar-accent size-9 shrink-0 animate-pulse rounded-full"
          aria-hidden
        />
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
      <Popover.Root>
        <Popover.Trigger
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
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner
            side="inline-end"
            align="end"
            sideOffset={8}
            className="isolate z-50"
          >
            <Popover.Popup
              className={cn(
                "bg-popover text-popover-foreground ring-foreground/10 w-56 origin-(--transform-origin) rounded-lg p-2 shadow-md ring-1",
                "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
                "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
              )}
            >
              <div className="border-border mb-2 border-b px-1 pb-2">
                <p className="truncate text-sm font-medium">{name}</p>
                {email ? (
                  <p className="text-muted-foreground truncate text-xs">{email}</p>
                ) : null}
              </div>
              <SignOutButton redirectUrl="/sign-in">
                <button
                  type="button"
                  className={cn(
                    "hover:bg-muted text-destructive focus-visible:ring-ring flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm font-medium outline-none focus-visible:ring-2",
                  )}
                >
                  <LogOut className="size-4 shrink-0" aria-hidden />
                  Log out
                </button>
              </SignOutButton>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
