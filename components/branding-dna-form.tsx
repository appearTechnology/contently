"use client";

import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";
import {
  Globe,
  Layout,
  Loader2,
  MessageSquare,
  Palette,
  Save,
  Sparkles,
  Type,
} from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { importBrandDnaFromUrl } from "@/lib/branding/import-url-new/client";
import type { ParsedBrandDNA } from "@/lib/branding/import-url-new/parse";
import { cn } from "@/lib/utils";

function ReadOnlyField({
  id,
  label,
  value,
  multiline,
}: {
  id: string;
  label: string;
  value: string;
  multiline?: boolean;
}) {
  const empty = !value.trim();
  const display = empty ? "—" : value;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {multiline ? (
        <Textarea
          id={id}
          value={display}
          readOnly
          rows={3}
          tabIndex={-1}
          className={cn(
            "resize-none cursor-default bg-muted/40",
            empty && "text-muted-foreground",
          )}
        />
      ) : (
        <Input
          id={id}
          value={display}
          readOnly
          tabIndex={-1}
          className={cn(
            "cursor-default bg-muted/40",
            empty && "text-muted-foreground",
          )}
        />
      )}
    </div>
  );
}

function Chips({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">—</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, i) => (
        <span
          key={`${i}-${item}`}
          className="border-border bg-muted/50 text-foreground inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function Swatches({ label, colors }: { label: string; colors: string[] }) {
  return (
    <div className="space-y-3">
      <h3 className="text-foreground text-sm font-semibold">{label}</h3>
      {colors.length === 0 ? (
        <p className="text-muted-foreground text-sm">—</p>
      ) : (
        <div className="flex flex-wrap gap-8 sm:gap-10">
          {colors.map((color, idx) => (
            <div
              key={`${idx}-${color}`}
              className="flex w-[72px] flex-col items-center gap-2.5"
            >
              <div
                className="border-border size-[50px] shrink-0 rounded-full border-2 shadow-sm"
                style={{ backgroundColor: color }}
                aria-hidden
              />
              <span className="text-muted-foreground font-mono text-[11px] tabular-nums tracking-tight">
                {color}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function BrandingDnaForm({
  initialDna,
}: {
  initialDna: ParsedBrandDNA | null;
}) {
  const [dna, setDna] = useState<ParsedBrandDNA | null>(initialDna);
  const [importUrl, setImportUrl] = useState(initialDna?.url ?? "");
  const [analyzing, setAnalyzing] = useState(false);

  const runAnalyze = async () => {
    setAnalyzing(true);
    try {
      const result = await importBrandDnaFromUrl(importUrl);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setDna(result.dna);
      toast.success("Brand DNA extracted from the site.");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-8">
      <Card>
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2 text-2xl">
            <Sparkles className="size-6" aria-hidden />
            Brand DNA
          </CardTitle>
          <CardDescription className="max-w-2xl text-sm leading-relaxed">
            Analyze a website and we extract its brand DNA — identity, colors,
            type, voice, and messaging. Fields below are read-only previews of
            the extracted DNA.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Globe className="size-5" aria-hidden />
            Analyze a website
          </CardTitle>
          <CardDescription className="max-w-2xl text-sm leading-relaxed">
            Paste a public homepage (any domain). We fetch the page on the
            server, extract colors, fonts, and copy, then use AI to infer the
            brand DNA. Results are saved automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-2">
              <Label htmlFor="brand-dna-url">Website URL</Label>
              <Input
                id="brand-dna-url"
                type="text"
                inputMode="url"
                placeholder="yoursite.com or https://yoursite.co.uk"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                disabled={analyzing}
                autoComplete="url"
              />
            </div>
            <Button
              type="button"
              className="shrink-0 gap-2 sm:mb-0"
              disabled={analyzing}
              onClick={() => void runAnalyze()}
            >
              {analyzing ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Globe className="size-4" aria-hidden />
              )}
              Analyze site
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Brand identity</CardTitle>
          <CardDescription>What the brand is and who it serves.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <ReadOnlyField
            id="dna-brand-name"
            label="Brand name"
            value={dna?.brandName ?? ""}
          />
          <ReadOnlyField
            id="dna-industry"
            label="Industry"
            value={dna?.industry ?? ""}
          />
          <div className="sm:col-span-2">
            <ReadOnlyField
              id="dna-tagline"
              label="Tagline"
              value={dna?.tagline ?? ""}
            />
          </div>
          <div className="sm:col-span-2">
            <ReadOnlyField
              id="dna-value-proposition"
              label="Value proposition"
              value={dna?.valueProposition ?? ""}
              multiline
            />
          </div>
          <div className="sm:col-span-2">
            <ReadOnlyField
              id="dna-target-audience"
              label="Target audience"
              value={dna?.targetAudience ?? ""}
              multiline
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Palette className="size-5" aria-hidden />
            Color palette
          </CardTitle>
          <CardDescription>
            Primary and secondary colors detected from the site.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <Swatches label="Primary" colors={dna?.primaryColors ?? []} />
          <Swatches label="Secondary" colors={dna?.secondaryColors ?? []} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Type className="size-5" aria-hidden />
            Typography
          </CardTitle>
          <CardDescription>Font families found on the site.</CardDescription>
        </CardHeader>
        <CardContent>
          {(dna?.fonts ?? []).length === 0 ? (
            <p className="text-muted-foreground text-sm">—</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {(dna?.fonts ?? []).map((font, i) => (
                <div
                  key={`${i}-${font}`}
                  className="border-border bg-muted/30 flex flex-col gap-1.5 rounded-lg border p-4"
                >
                  <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    {font}
                  </span>
                  <span
                    className="text-foreground truncate text-2xl"
                    style={{ fontFamily: `${font}, system-ui, sans-serif` }}
                  >
                    Ag
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquare className="size-5" aria-hidden />
            Voice &amp; messaging
          </CardTitle>
          <CardDescription>
            Tone, personality, and the key messages the brand leads with.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="space-y-2">
            <Label>Tone of voice</Label>
            <Chips items={dna?.toneOfVoice ?? []} />
          </div>
          <div className="space-y-2">
            <Label>Brand personality</Label>
            <Chips items={dna?.brandPersonality ?? []} />
          </div>
          <div className="space-y-2">
            <Label>Key messages</Label>
            <Chips items={dna?.keyMessages ?? []} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Layout className="size-5" aria-hidden />
            Style
          </CardTitle>
          <CardDescription>
            Imagery and layout direction inferred from the screenshot.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <ReadOnlyField
            id="dna-imagery-style"
            label="Imagery style"
            value={dna?.imageryStyle ?? ""}
          />
          <ReadOnlyField
            id="dna-layout-style"
            label="Layout style"
            value={dna?.layoutStyle ?? ""}
          />
          {dna?.logoUrl ? (
            <div className="space-y-2">
              <Label>Logo</Label>
              <div className="bg-muted/30 relative h-24 w-40 overflow-hidden rounded-lg border">
                <Image
                  src={dna.logoUrl}
                  alt="Detected brand logo"
                  fill
                  className="object-contain p-2"
                  unoptimized
                />
              </div>
            </div>
          ) : null}
          {dna?.screenshotUrl ? (
            <div className="space-y-2">
              <Label>Screenshot</Label>
              <div className="bg-muted/30 relative aspect-video w-full overflow-hidden rounded-lg border">
                <Image
                  src={dna.screenshotUrl}
                  alt="Website screenshot"
                  fill
                  className="object-cover object-top"
                  unoptimized
                />
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button type="button" size="lg" className="gap-2" disabled>
          <Save className="size-4" aria-hidden />
          Save branding
        </Button>
      </div>
    </div>
  );
}
