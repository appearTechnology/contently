"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";
import { PasswordField } from "@/components/auth/password-field";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!cancelled) setTimedOut(true);
    }, 12_000);

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled && session) setReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Use at least 8 characters for your new password.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Password updated. You can sign in with the new password.");
      await supabase.auth.signOut();
      router.replace("/sign-in");
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="font-heading text-2xl tracking-tight">
          Set new password
        </CardTitle>
        <CardDescription className="text-base leading-relaxed">
          Choose a new password for your account. This page opens from the link
          in your reset email.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!ready && !timedOut ? (
          <p className="text-muted-foreground text-sm leading-relaxed">
            Checking your reset link… If this does not continue, open the link
            from your email again or request a new reset from sign-in.
          </p>
        ) : !ready && timedOut ? (
          <p className="text-muted-foreground text-sm leading-relaxed">
            This reset link is invalid or expired. Request a new one from the
            sign-in page, and confirm your Supabase project allows redirecting to{" "}
            <code className="text-foreground rounded bg-muted px-1 py-0.5 text-xs">
              …/auth/callback?next=/auth/update-password
            </code>
            .
          </p>
        ) : (
          <form className="flex flex-col gap-4" onSubmit={onSubmit}>
            <PasswordField
              id="reset-password-new"
              label="New password"
              name="new-password"
              autoComplete="new-password"
              value={password}
              onChange={setPassword}
              disabled={loading}
            />
            <PasswordField
              id="reset-password-confirm"
              label="Confirm new password"
              name="confirm-password"
              autoComplete="new-password"
              value={confirm}
              onChange={setConfirm}
              disabled={loading}
            />
            <Button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Updating…
                </>
              ) : (
                <>
                  <KeyRound className="size-4" aria-hidden />
                  Update password
                </>
              )}
            </Button>
          </form>
        )}
        <Button
          variant="outline"
          className="w-full"
          nativeButton={false}
          render={<Link href="/sign-in" />}
        >
          Back to sign in
        </Button>
      </CardContent>
    </Card>
  );
}
