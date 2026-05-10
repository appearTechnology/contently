"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import { Globe, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { importBrandingFromUrl } from "@/lib/branding/import-url/client";

export function OnboardingForm() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWarnings([]);
    setLoading(true);
    try {
      const result = await importBrandingFromUrl(url);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setWarnings(result.warnings);

      const markRes = await fetch("/api/onboarding/complete", { method: "POST" });
      const marked = (await markRes.json()) as { ok: boolean; error?: string };
      if (!markRes.ok || !marked.ok) {
        toast.error(marked.error || "Could not finish onboarding.");
        return;
      }

      await user?.reload();
      toast.success(
        result.warnings.length > 0
          ? "Branding imported with notes — you can refine it in Branding."
          : "Branding imported. Welcome to your studio.",
      );
      router.replace("/");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading flex items-center gap-2 text-xl">
          <Globe className="size-5" aria-hidden />
          Your business website
        </CardTitle>
        <CardDescription className="text-sm leading-relaxed">
          We will analyze the public page to pre-fill colors, fonts, logo hints,
          and voice notes in your branding kit. Use your domain with or without
          https:// — any TLD is fine. You can edit everything later in Branding.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="onboarding-url">Website URL</Label>
            <Input
              id="onboarding-url"
              type="text"
              inputMode="url"
              placeholder="yoursite.com or https://yoursite.io"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={loading || !isLoaded}
              required
              autoComplete="url"
            />
          </div>
          {warnings.length > 0 ? (
            <Alert>
              <AlertTitle>Import notes</AlertTitle>
              <AlertDescription>
                <ul className="mt-2 list-inside list-disc text-sm">
                  {warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : null}
          <Button type="submit" disabled={loading || !isLoaded} className="w-full sm:w-auto">
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Analyzing…
              </>
            ) : (
              "Continue to dashboard"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
