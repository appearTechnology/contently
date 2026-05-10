"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Globe,
  ImageIcon,
  Loader2,
  Palette,
  Save,
  Trash2,
  Type,
} from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { BrandingTypographySlot } from "@/components/branding-typography-slot";
import { importBrandingFromUrl } from "@/lib/branding/import-url/client";
import {
  DEFAULT_BRANDING_KIT_VIEW,
  type BrandingKit,
  type BrandingKitView,
} from "@/lib/branding/types";
import { saveBrandingKit } from "@/lib/branding/storage";
import { cn } from "@/lib/utils";

const LOGO_ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_LOGO_BYTES = 8 * 1024 * 1024;

export function BrandingKitForm({
  initialView = DEFAULT_BRANDING_KIT_VIEW,
}: {
  initialView?: BrandingKitView;
}) {
  const [view, setView] = useState<BrandingKitView>(initialView);
  const [kit, setKit] = useState<BrandingKit>(initialView.kit);

  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [pendingHeadingFontFile, setPendingHeadingFontFile] = useState<File | null>(
    null,
  );
  const [removeHeadingFont, setRemoveHeadingFont] = useState(false);
  const [pendingBodyFontFile, setPendingBodyFontFile] = useState<File | null>(null);
  const [removeBodyFont, setRemoveBodyFont] = useState(false);

  const [importUrl, setImportUrl] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const pendingLogoPreviewUrl = useMemo(
    () => (pendingLogoFile ? URL.createObjectURL(pendingLogoFile) : null),
    [pendingLogoFile],
  );
  useEffect(() => {
    if (!pendingLogoPreviewUrl) return;
    return () => URL.revokeObjectURL(pendingLogoPreviewUrl);
  }, [pendingLogoPreviewUrl]);

  const logoPreviewUrl = pendingLogoPreviewUrl
    ? pendingLogoPreviewUrl
    : removeLogo
      ? null
      : view.logoUrl;

  const onLogoChosen = useCallback((file: File | null) => {
    if (!file) {
      setPendingLogoFile(null);
      setRemoveLogo(true);
      return;
    }
    if (!LOGO_ACCEPT.split(",").includes(file.type)) {
      toast.error("Logo must be JPEG, PNG, or WebP.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error(`Logo must be at most ${MAX_LOGO_BYTES / (1024 * 1024)} MB.`);
      return;
    }
    setPendingLogoFile(file);
    setRemoveLogo(false);
    toast.success("Logo ready — click Save branding to upload.");
  }, []);

  const onHeadingFontChosen = useCallback((file: File) => {
    setPendingHeadingFontFile(file);
    setRemoveHeadingFont(false);
  }, []);

  const onClearHeadingFont = useCallback(() => {
    if (pendingHeadingFontFile) {
      setPendingHeadingFontFile(null);
      return;
    }
    if (view.headingFontUrl) setRemoveHeadingFont(true);
  }, [pendingHeadingFontFile, view.headingFontUrl]);

  const onBodyFontChosen = useCallback((file: File) => {
    setPendingBodyFontFile(file);
    setRemoveBodyFont(false);
  }, []);

  const onClearBodyFont = useCallback(() => {
    if (pendingBodyFontFile) {
      setPendingBodyFontFile(null);
      return;
    }
    if (view.bodyFontUrl) setRemoveBodyFont(true);
  }, [pendingBodyFontFile, view.bodyFontUrl]);

  const persistAll = useCallback(async () => {
    setSaving(true);
    try {
      const result = await saveBrandingKit(
        kit,
        {
          logo: pendingLogoFile,
          headingFont: pendingHeadingFontFile,
          bodyFont: pendingBodyFontFile,
        },
        {
          removeLogo,
          removeHeadingFont,
          removeBodyFont,
        },
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setView(result.view);
      setKit(result.view.kit);
      setPendingLogoFile(null);
      setPendingHeadingFontFile(null);
      setPendingBodyFontFile(null);
      setRemoveLogo(false);
      setRemoveHeadingFont(false);
      setRemoveBodyFont(false);
      toast.success("Branding saved.");
    } finally {
      setSaving(false);
    }
  }, [
    kit,
    pendingLogoFile,
    pendingHeadingFontFile,
    pendingBodyFontFile,
    removeLogo,
    removeHeadingFont,
    removeBodyFont,
  ]);

  const runWebsiteImport = async () => {
    setImportWarnings([]);
    setImportLoading(true);
    try {
      const result = await importBrandingFromUrl(importUrl);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setView(result.view);
      setKit(result.view.kit);
      setPendingLogoFile(null);
      setPendingHeadingFontFile(null);
      setPendingBodyFontFile(null);
      setRemoveLogo(false);
      setRemoveHeadingFont(false);
      setRemoveBodyFont(false);
      setImportWarnings(result.warnings);
      toast.success(
        result.warnings.length > 0
          ? "Imported with notes — review warnings below."
          : "Imported branding from the site.",
      );
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-8">
      <Card>
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2 text-2xl">
            <Palette className="size-6" aria-hidden />
            Branding kit
          </CardTitle>
          <CardDescription className="max-w-2xl text-sm leading-relaxed">
            Save colors, type, voice, and an optional logo. When you generate ads,
            these details can be applied automatically so creatives stay on-brand.
            Everything is stored in your private Supabase project.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Globe className="size-5" aria-hidden />
            Import from website
          </CardTitle>
          <CardDescription className="max-w-2xl text-sm leading-relaxed">
            Paste a public homepage (any domain — .com, .io, .co.uk, etc.). We fetch the
            page on the server (SSRF-safe), extract colors, fonts, logo hints, and meta
            copy, then use AI to suggest voice and tone. Imported branding is saved
            immediately; review and refine below.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-2">
              <Label htmlFor="brand-import-url">Website URL</Label>
              <Input
                id="brand-import-url"
                type="text"
                inputMode="url"
                placeholder="yoursite.com or https://yoursite.co.uk"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                disabled={importLoading}
                autoComplete="url"
              />
            </div>
            <Button
              type="button"
              className="shrink-0 gap-2 sm:mb-0"
              disabled={importLoading}
              onClick={() => void runWebsiteImport()}
            >
              {importLoading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Globe className="size-4" aria-hidden />
              )}
              Analyze site
            </Button>
          </div>
          {importWarnings.length > 0 ? (
            <Alert variant="default">
              <AlertTitle>Import notes</AlertTitle>
              <AlertDescription>
                <ul className="mt-1 list-inside list-disc">
                  {importWarnings.map((w, i) => (
                    <li key={`${i}-${w.slice(0, 48)}`}>{w}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Brand identity</CardTitle>
          <CardDescription>How the brand should read on the canvas.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="brand-name">Brand name</Label>
            <Input
              id="brand-name"
              value={kit.brandName}
              onChange={(e) => setKit({ ...kit, brandName: e.target.value })}
              placeholder="e.g. Northwind Coffee"
              autoComplete="organization"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="brand-tagline">Tagline or hero line</Label>
            <Input
              id="brand-tagline"
              value={kit.tagline}
              onChange={(e) => setKit({ ...kit, tagline: e.target.value })}
              placeholder="Short line that may appear in lockups"
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
            Hex values help the model align gradients, backgrounds, and accents.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          {(
            [
              ["primaryColor", "Primary", kit.primaryColor],
              ["secondaryColor", "Secondary", kit.secondaryColor],
              ["accentColor", "Accent", kit.accentColor],
            ] as const
          ).map(([key, label, value]) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={`color-${key}`}>{label}</Label>
              <div className="flex gap-2">
                <Input
                  id={`color-${key}`}
                  type="color"
                  className={cn(
                    "h-10 w-14 shrink-0 cursor-pointer p-1",
                    !value && "border-dashed",
                  )}
                  value={value ? normalizeHexForPicker(value) : "#ffffff"}
                  onChange={(e) =>
                    setKit({ ...kit, [key]: e.target.value } as BrandingKit)
                  }
                  aria-label={`${label} color picker`}
                />
                <Input
                  value={value}
                  onChange={(e) =>
                    setKit({ ...kit, [key]: e.target.value } as BrandingKit)
                  }
                  placeholder="#1a1a1a"
                  className="font-mono text-sm"
                  aria-label={`${label} hex value`}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Type className="size-5" aria-hidden />
            Typography
          </CardTitle>
          <CardDescription>
            Pick a curated Google Font, upload your own file for previews, or describe
            type freely — all flow into the generator brief.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <BrandingTypographySlot
            label="Heading"
            slotKey="heading"
            slot={kit.headingTypography}
            previewSize="heading"
            customFontUrl={removeHeadingFont ? null : view.headingFontUrl}
            customFontMediaType={view.headingFontMediaType}
            pendingFontFile={pendingHeadingFontFile}
            onFontFileChosen={onHeadingFontChosen}
            onClearFont={onClearHeadingFont}
            onChange={(headingTypography) => setKit({ ...kit, headingTypography })}
          />
          <BrandingTypographySlot
            label="Body"
            slotKey="body"
            slot={kit.bodyTypography}
            previewSize="body"
            customFontUrl={removeBodyFont ? null : view.bodyFontUrl}
            customFontMediaType={view.bodyFontMediaType}
            pendingFontFile={pendingBodyFontFile}
            onFontFileChosen={onBodyFontChosen}
            onClearFont={onClearBodyFont}
            onChange={(bodyTypography) => setKit({ ...kit, bodyTypography })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Voice & tone</CardTitle>
          <CardDescription>
            Guidance merged into the generator prompt alongside your creative
            direction.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            id="voice-tone"
            value={kit.voiceTone}
            onChange={(e) => setKit({ ...kit, voiceTone: e.target.value })}
            placeholder="e.g. Confident but friendly; short sentences; avoid jargon; celebrate the craft."
            rows={4}
            className="resize-y min-h-[100px]"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Extra notes</CardTitle>
          <CardDescription>
            Legal mandatories, icon style, photography preferences, or layout rules.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            id="extra-notes"
            value={kit.extraNotes}
            onChange={(e) => setKit({ ...kit, extraNotes: e.target.value })}
            placeholder="e.g. Always leave clear space around the logo; avoid busy patterns behind packshots."
            rows={3}
            className="resize-y min-h-[80px]"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ImageIcon className="size-5" aria-hidden />
            Logo reference
          </CardTitle>
          <CardDescription>
            Optional lockup sent as a second reference image during generation. Stored
            privately in your Supabase bucket (max {MAX_LOGO_BYTES / (1024 * 1024)} MB).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {logoPreviewUrl ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="relative h-24 w-40 overflow-hidden rounded-lg border bg-muted/30">
                <Image
                  src={logoPreviewUrl}
                  alt="Brand logo preview"
                  fill
                  className="object-contain p-2"
                  unoptimized
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 self-start"
                onClick={() => onLogoChosen(null)}
              >
                <Trash2 className="size-4" aria-hidden />
                {pendingLogoFile ? "Discard pending logo" : "Remove on next Save"}
              </Button>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="brand-logo-upload">Upload logo</Label>
            <Input
              id="brand-logo-upload"
              type="file"
              accept={LOGO_ACCEPT}
              className="cursor-pointer"
              onChange={(e) => {
                const f = e.target.files?.[0];
                onLogoChosen(f ?? null);
                e.target.value = "";
              }}
            />
            {pendingLogoFile ? (
              <p className="text-muted-foreground text-xs">
                Pending: <span className="font-medium">{pendingLogoFile.name}</span>{" "}
                — click Save branding to upload.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          size="lg"
          className="gap-2"
          disabled={saving}
          onClick={() => void persistAll()}
        >
          {saving ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Save className="size-4" aria-hidden />
          )}
          Save branding
        </Button>
      </div>
    </div>
  );
}

function normalizeHexForPicker(hex: string): string {
  const t = hex.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(t)) return t;
  if (/^[0-9a-fA-F]{6}$/.test(t)) return `#${t}`;
  return "#ffffff";
}
