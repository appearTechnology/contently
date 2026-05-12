"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  PasswordField,
  passwordMeetsSignUpRules,
  signUpPasswordRequirements,
} from "@/components/auth/password-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function callbackBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined") return window.location.origin;
  return "http://localhost:3000";
}

export function SignUpPanel() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordMeetsSignUpRules(password)) {
      toast.error("Please meet all password requirements below.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${callbackBaseUrl()}/auth/callback`,
        },
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      if (data.session) {
        toast.success("Account created. You are signed in.");
        router.refresh();
        router.replace("/");
        return;
      }
      toast.success("Check your email to confirm your account, then sign in.");
      router.push("/sign-in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="font-heading text-2xl tracking-tight">
          Create account
        </CardTitle>
        <CardDescription className="text-base leading-relaxed">
          Use your work email and a strong password. If your project requires
          email confirmation, we will send a link before you can sign in.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="sign-up-email">Email</Label>
            <Input
              id="sign-up-email"
              type="email"
              name="email"
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <PasswordField
            id="sign-up-password"
            label="Password"
            name="password"
            autoComplete="new-password"
            value={password}
            onChange={setPassword}
            disabled={loading}
            requirements={signUpPasswordRequirements}
          />
          <Button
            type="submit"
            disabled={loading || !passwordMeetsSignUpRules(password)}
            className="w-full sm:w-auto"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Creating account…
              </>
            ) : (
              <>
                <UserPlus className="size-4" aria-hidden />
                Create account
              </>
            )}
          </Button>
        </form>
        <p className="text-muted-foreground border-t pt-4 text-center text-sm">
          Already have an account?{" "}
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            nativeButton={false}
            render={<Link href="/sign-in" />}
          >
            Sign in
          </Button>
        </p>
      </CardContent>
    </Card>
  );
}
