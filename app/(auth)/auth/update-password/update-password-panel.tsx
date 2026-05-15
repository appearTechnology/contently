"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";
import {
  PasswordField,
  passwordMeetsSignUpRules,
  signUpPasswordRequirements,
} from "@/components/auth/password-field";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type UpdatePasswordPanelProps = {
  canResetPassword: boolean;
};

export function UpdatePasswordPanel({
  canResetPassword,
}: UpdatePasswordPanelProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canResetPassword) return;
    if (!passwordMeetsSignUpRules(password)) {
      toast.error("Please meet all password requirements below.");
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
      await fetch("/api/auth/password-recovery", { method: "DELETE" });
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
        {!canResetPassword ? (
          <p className="text-muted-foreground text-sm leading-relaxed">
            This reset link is invalid or expired. Request a new one from the
            sign-in page, then open the latest link from your email.
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
              requirements={signUpPasswordRequirements}
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
              disabled={loading || !passwordMeetsSignUpRules(password)}
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

