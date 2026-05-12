"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2, Mail } from "lucide-react";
import { PasswordField } from "@/components/auth/password-field";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function callbackBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined") return window.location.origin;
  return "http://localhost:3000";
}

export function SignInPanel() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [magicSent, setMagicSent] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [loadingMagic, setLoadingMagic] = useState(false);
  const [loadingReset, setLoadingReset] = useState(false);

  const onPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingPassword(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Signed in.");
      router.refresh();
      router.replace("/");
    } finally {
      setLoadingPassword(false);
    }
  };

  const onForgotPassword = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error("Enter your email first, then tap Forgot password.");
      return;
    }
    setLoadingReset(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const redirectTo = `${callbackBaseUrl()}/auth/callback?next=/auth/update-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("If that email has an account, you will get a reset link shortly.");
    } finally {
      setLoadingReset(false);
    }
  };

  const onMagicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingMagic(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const redirectTo = `${callbackBaseUrl()}/auth/callback`;
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: redirectTo,
        },
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      setMagicSent(true);
      toast.success("Check your email for the sign-in link.");
    } finally {
      setLoadingMagic(false);
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="font-heading text-2xl tracking-tight">
          Sign in
        </CardTitle>
        <CardDescription className="text-base leading-relaxed">
          Use your password, or get a one-time link by email.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="password" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="password">Password</TabsTrigger>
            <TabsTrigger value="magic">Magic link</TabsTrigger>
          </TabsList>

          <TabsContent value="password" className="mt-4 flex flex-col gap-4">
            <form className="flex flex-col gap-4" onSubmit={onPasswordSubmit}>
              <div className="space-y-2">
                <Label htmlFor="sign-in-email-password">Email</Label>
                <Input
                  id="sign-in-email-password"
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loadingPassword}
                />
              </div>
              <PasswordField
                id="sign-in-password"
                label="Password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={setPassword}
                disabled={loadingPassword}
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="link"
                  className="text-muted-foreground h-auto px-0 py-0 text-xs font-normal underline-offset-4 hover:underline"
                  onClick={() => void onForgotPassword()}
                  disabled={loadingPassword || loadingReset}
                >
                  {loadingReset ? "Sending reset link…" : "Forgot password?"}
                </Button>
              </div>
              <Button
                type="submit"
                disabled={loadingPassword}
                className="w-full sm:w-auto"
              >
                {loadingPassword ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Signing in…
                  </>
                ) : (
                  <>
                    <KeyRound className="size-4" aria-hidden />
                    Sign in
                  </>
                )}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="magic" className="mt-4 flex flex-col gap-4">
            <p className="text-muted-foreground text-sm leading-relaxed">
              {magicSent
                ? "We sent a magic link to your inbox. Open it on this device to continue."
                : "We will email you a one-time sign-in link (same email field as the password tab)."}
            </p>
            <form className="flex flex-col gap-4" onSubmit={onMagicSubmit}>
              <div className="space-y-2">
                <Label htmlFor="sign-in-email-magic">Email</Label>
                <Input
                  id="sign-in-email-magic"
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loadingMagic || magicSent}
                />
              </div>
              <Button
                type="submit"
                disabled={loadingMagic || magicSent}
                className="w-full sm:w-auto"
              >
                {loadingMagic ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Sending…
                  </>
                ) : magicSent ? (
                  "Link sent"
                ) : (
                  <>
                    <Mail className="size-4" aria-hidden />
                    Send magic link
                  </>
                )}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
        <div className="mt-6 flex flex-col gap-2 border-t pt-4">
          <Button
            variant="outline"
            className="w-full"
            nativeButton={false}
            render={<Link href="/sign-up" />}
          >
            Create account
          </Button>
          <p className="text-muted-foreground text-center text-xs leading-relaxed">
            New here? Register with email and password, then complete onboarding.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
