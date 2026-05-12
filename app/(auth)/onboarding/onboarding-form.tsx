"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { BrandAnalysisOverlay } from "@/components/onboarding/brand-analysis-overlay";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { importBrandingFromUrl } from "@/lib/branding/import-url/client";

export function OnboardingForm() {
  const router = useRouter();
  const [sessionReady, setSessionReady] = useState(false);
  const [url, setUrl] = useState("");
  const [importing, setImporting] = useState(false);
  /** Remounts the analysis overlay so cycling copy resets for each import. */
  const [importRunId, setImportRunId] = useState(0);
  const [skipping, setSkipping] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const busy = importing || skipping;

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    void supabase.auth.getSession().then(({ data: { session } }) => {
      setSessionReady(!!session);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionReady(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWarnings([]);
    setImportRunId((n) => n + 1);
    setImporting(true);
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

      router.refresh();
      toast.success(
        result.warnings.length > 0
          ? "Branding imported with notes — you can refine it in Branding."
          : "Branding imported. Welcome to your studio.",
      );
      router.replace("/");
    } finally {
      setImporting(false);
    }
  };

  const onSkip = async () => {
    if (!sessionReady || busy) return;
    setSkipping(true);
    try {
      const markRes = await fetch("/api/onboarding/complete", { method: "POST" });
      const marked = (await markRes.json()) as { ok: boolean; error?: string };
      if (!markRes.ok || !marked.ok) {
        toast.error(marked.error || "Could not finish onboarding.");
        return;
      }
      router.refresh();
      toast.success("You can set up branding anytime in Branding.");
      router.replace("/");
    } finally {
      setSkipping(false);
    }
  };

  return (
    <>
      {importing ? (
        <BrandAnalysisOverlay key={importRunId} />
      ) : null}
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
          disabled={busy || !sessionReady}
          required
          autoComplete="url"
        />
      </div>
      {!sessionReady ? (
        <Alert>
          <AlertTitle>Sign in required</AlertTitle>
          <AlertDescription className="text-sm">
            Open a magic link in this browser first so we can save branding to your
            account.
          </AlertDescription>
        </Alert>
      ) : null}
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
      <div className="flex flex-col gap-2">
        <Button
          type="submit"
          disabled={busy || !sessionReady}
          className="w-full sm:w-auto"
        >
          Continue to dashboard
        </Button>
        <Button
          type="button"
          variant="link"
          disabled={busy || !sessionReady}
          className="text-muted-foreground h-auto justify-center gap-2 px-0 py-2 font-normal"
          onClick={() => void onSkip()}
        >
          {skipping ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Skipping…
            </>
          ) : (
            "Skip for now"
          )}
        </Button>
      </div>
    </form>
    </>
  );
}
