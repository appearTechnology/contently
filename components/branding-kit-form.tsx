"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  FileText,
  Globe,
  ImageIcon,
  Images,
  Loader2,
  Palette,
  Plus,
  Save,
  Shapes,
  Trash2,
  Type,
  X,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { BrandingTypographySlot } from "@/components/branding-typography-slot";
import { importBrandingFromUrl } from "@/lib/branding/import-url/client";
import { importBrandingFromPdf } from "@/lib/branding/import-pdf/client";
import {
  DEFAULT_BRANDING_KIT_VIEW,
  type BrandingKit,
  type BrandingKitView,
} from "@/lib/branding/types";
import {
  MAX_VOICE_TONE_TAGS,
  normalizeVoiceToneTags,
} from "@/lib/branding/voice-tone-tags";
import {
  MAX_EXTRA_PALETTE_COLORS,
  parseHexString,
} from "@/lib/branding/extra-palette-colors";
import { saveBrandingKit } from "@/lib/branding/storage";
import { cn } from "@/lib/utils";

function toastSaveOrImportError(message: string, hint?: string) {
  if (hint) toast.error(message, { description: hint });
  else toast.error(message);
}

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
  const [pendingSecondaryLogoFile, setPendingSecondaryLogoFile] =
    useState<File | null>(null);
  const [removeSecondaryLogo, setRemoveSecondaryLogo] = useState(false);
  const [pendingIconFile, setPendingIconFile] = useState<File | null>(null);
  const [removeIcon, setRemoveIcon] = useState(false);
  const [pendingHeadingFontFile, setPendingHeadingFontFile] = useState<File | null>(
    null,
  );
  const [removeHeadingFont, setRemoveHeadingFont] = useState(false);
  const [pendingBodyFontFile, setPendingBodyFontFile] = useState<File | null>(null);
  const [removeBodyFont, setRemoveBodyFont] = useState(false);

  const [importUrl, setImportUrl] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [pdfImportLoading, setPdfImportLoading] = useState(false);
  const [pdfImportWarnings, setPdfImportWarnings] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const [addColorOpen, setAddColorOpen] = useState(false);
  const [addColorHexDraft, setAddColorHexDraft] = useState("#000000");

  const pendingLogoPreviewUrl = useMemo(
    () => (pendingLogoFile ? URL.createObjectURL(pendingLogoFile) : null),
    [pendingLogoFile],
  );
  useEffect(() => {
    if (!pendingLogoPreviewUrl) return;
    return () => URL.revokeObjectURL(pendingLogoPreviewUrl);
  }, [pendingLogoPreviewUrl]);

  const pendingSecondaryPreviewUrl = useMemo(
    () => (pendingSecondaryLogoFile ? URL.createObjectURL(pendingSecondaryLogoFile) : null),
    [pendingSecondaryLogoFile],
  );
  useEffect(() => {
    if (!pendingSecondaryPreviewUrl) return;
    return () => URL.revokeObjectURL(pendingSecondaryPreviewUrl);
  }, [pendingSecondaryPreviewUrl]);

  const pendingIconPreviewUrl = useMemo(
    () => (pendingIconFile ? URL.createObjectURL(pendingIconFile) : null),
    [pendingIconFile],
  );
  useEffect(() => {
    if (!pendingIconPreviewUrl) return;
    return () => URL.revokeObjectURL(pendingIconPreviewUrl);
  }, [pendingIconPreviewUrl]);

  const secondaryLogoPreviewUrl = pendingSecondaryPreviewUrl
    ? pendingSecondaryPreviewUrl
    : removeSecondaryLogo
      ? null
      : view.secondaryLogoUrl;

  const iconPreviewUrl = pendingIconPreviewUrl
    ? pendingIconPreviewUrl
    : removeIcon
      ? null
      : view.iconUrl;

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

  const onSecondaryLogoChosen = useCallback((file: File | null) => {
    if (!file) {
      setPendingSecondaryLogoFile(null);
      setRemoveSecondaryLogo(true);
      return;
    }
    if (!LOGO_ACCEPT.split(",").includes(file.type)) {
      toast.error("Image must be JPEG, PNG, or WebP.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error(`Image must be at most ${MAX_LOGO_BYTES / (1024 * 1024)} MB.`);
      return;
    }
    setPendingSecondaryLogoFile(file);
    setRemoveSecondaryLogo(false);
    toast.success("Secondary logo ready — click Save branding to upload.");
  }, []);

  const onIconChosen = useCallback((file: File | null) => {
    if (!file) {
      setPendingIconFile(null);
      setRemoveIcon(true);
      return;
    }
    if (!LOGO_ACCEPT.split(",").includes(file.type)) {
      toast.error("Image must be JPEG, PNG, or WebP.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error(`Image must be at most ${MAX_LOGO_BYTES / (1024 * 1024)} MB.`);
      return;
    }
    setPendingIconFile(file);
    setRemoveIcon(false);
    toast.success("Icon ready — click Save branding to upload.");
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

  /** Persist kit JSON only (no pending file uploads, no remove-* flags). */
  const persistKitJsonOnly = useCallback(async (nextKit: BrandingKit): Promise<boolean> => {
    setSaving(true);
    try {
      const result = await saveBrandingKit(nextKit, {}, {});
      if (!result.ok) {
        toastSaveOrImportError(result.error, result.hint);
        return false;
      }
      setView(result.view);
      setKit(result.view.kit);
      return true;
    } finally {
      setSaving(false);
    }
  }, []);

  const commitAddExtraPaletteColor = useCallback(async () => {
    const hex = parseHexString(addColorHexDraft);
    if (!hex) {
      toast.error("Enter a valid hex colour (#RGB or #RRGGBB).");
      return;
    }
    if (kit.extraPaletteColors.length >= MAX_EXTRA_PALETTE_COLORS) return;
    const nextKit: BrandingKit = {
      ...kit,
      extraPaletteColors: [...kit.extraPaletteColors, hex],
    };
    const ok = await persistKitJsonOnly(nextKit);
    if (ok) {
      setAddColorOpen(false);
      toast.success("Colour saved.");
    }
  }, [kit, addColorHexDraft, persistKitJsonOnly]);

  const removeExtraPaletteColorAt = useCallback(
    async (idx: number) => {
      const nextKit: BrandingKit = {
        ...kit,
        extraPaletteColors: kit.extraPaletteColors.filter((_, i) => i !== idx),
      };
      await persistKitJsonOnly(nextKit);
    },
    [kit, persistKitJsonOnly],
  );

  const persistAll = useCallback(async () => {
    setSaving(true);
    try {
      const result = await saveBrandingKit(
        kit,
        {
          logo: pendingLogoFile,
          secondaryLogo: pendingSecondaryLogoFile,
          icon: pendingIconFile,
          headingFont: pendingHeadingFontFile,
          bodyFont: pendingBodyFontFile,
        },
        {
          removeLogo,
          removeSecondaryLogo,
          removeIcon,
          removeHeadingFont,
          removeBodyFont,
        },
      );
      if (!result.ok) {
        toastSaveOrImportError(result.error, result.hint);
        return;
      }
      setView(result.view);
      setKit(result.view.kit);
      setPendingLogoFile(null);
      setPendingSecondaryLogoFile(null);
      setPendingIconFile(null);
      setPendingHeadingFontFile(null);
      setPendingBodyFontFile(null);
      setRemoveLogo(false);
      setRemoveSecondaryLogo(false);
      setRemoveIcon(false);
      setRemoveHeadingFont(false);
      setRemoveBodyFont(false);
      toast.success("Branding saved.");
    } finally {
      setSaving(false);
    }
  }, [
    kit,
    pendingLogoFile,
    pendingSecondaryLogoFile,
    pendingIconFile,
    pendingHeadingFontFile,
    pendingBodyFontFile,
    removeLogo,
    removeSecondaryLogo,
    removeIcon,
    removeHeadingFont,
    removeBodyFont,
  ]);

  const runWebsiteImport = async () => {
    setImportWarnings([]);
    setPdfImportWarnings([]);
    setImportLoading(true);
    try {
      const result = await importBrandingFromUrl(importUrl);
      if (!result.ok) {
        toastSaveOrImportError(result.error, result.hint);
        return;
      }
      setView(result.view);
      setKit(result.view.kit);
      setPendingLogoFile(null);
      setPendingSecondaryLogoFile(null);
      setPendingIconFile(null);
      setPendingHeadingFontFile(null);
      setPendingBodyFontFile(null);
      setRemoveLogo(false);
      setRemoveSecondaryLogo(false);
      setRemoveIcon(false);
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

  const runPdfImport = async (file: File) => {
    setPdfImportWarnings([]);
    setImportWarnings([]);
    setPdfImportLoading(true);
    try {
      const result = await importBrandingFromPdf(file);
      if (!result.ok) {
        toastSaveOrImportError(result.error, result.hint);
        return;
      }
      setView(result.view);
      setKit(result.view.kit);
      setPendingLogoFile(null);
      setPendingSecondaryLogoFile(null);
      setPendingIconFile(null);
      setPendingHeadingFontFile(null);
      setPendingBodyFontFile(null);
      setRemoveLogo(false);
      setRemoveSecondaryLogo(false);
      setRemoveIcon(false);
      setRemoveHeadingFont(false);
      setRemoveBodyFont(false);
      setPdfImportWarnings(result.warnings);
      const noFields =
        result.warnings.length > 0 &&
        result.warnings.some((w) =>
          w.includes("did not return any non-empty fields"),
        );
      if (noFields) {
        toast.message(
          "No branding fields were inferred from this PDF — your saved kit is unchanged.",
        );
      } else {
        toast.success(
          result.warnings.length > 0
            ? "PDF import finished — review notes below."
            : "Branding extracted from PDF and saved.",
        );
      }
    } finally {
      setPdfImportLoading(false);
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
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="size-5" aria-hidden />
            Import from brand guide (PDF)
          </CardTitle>
          <CardDescription className="max-w-2xl text-sm leading-relaxed">
            Upload a text-based PDF (exported from InDesign, Figma, Google Docs,
            etc.). We extract plain text on the server, then use AI to fill name,
            tagline, colors, typography hints, voice & tone, and layout notes.
            Logos and custom fonts are not pulled from PDFs yet — add those below
            or keep your existing uploads.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="brand-import-pdf">Brand guidelines PDF</Label>
            <Input
              id="brand-import-pdf"
              type="file"
              accept="application/pdf,.pdf"
              className="cursor-pointer"
              disabled={pdfImportLoading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void runPdfImport(f);
              }}
            />
            <p className="text-muted-foreground text-xs">
              Max 25 MB. Scanned pages need OCR first — image-only PDFs usually
              produce little text.
            </p>
          </div>
          {pdfImportLoading ? (
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Parsing PDF and extracting branding…
            </p>
          ) : null}
          {pdfImportWarnings.length > 0 ? (
            <Alert variant="default">
              <AlertTitle>PDF import notes</AlertTitle>
              <AlertDescription>
                <ul className="mt-1 list-inside list-disc">
                  {pdfImportWarnings.map((w, i) => (
                    <li key={`pdf-${i}-${w.slice(0, 48)}`}>{w}</li>
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
            Swatches feed the generator palette. Add up to {MAX_EXTRA_PALETTE_COLORS}{" "}
            extra colours beyond primary, secondary, and accent.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap justify-center gap-10 sm:justify-start sm:gap-12">
            {(
              [
                ["primaryColor", "Primary", kit.primaryColor],
                ["secondaryColor", "Secondary", kit.secondaryColor],
                ["accentColor", "Accent", kit.accentColor],
              ] as const
            ).map(([key, label, value]) => {
              const displayHex = value.trim()
                ? normalizeHexForPicker(value)
                : null;
              return (
                <div
                  key={key}
                  className="flex w-[72px] flex-col items-center gap-2.5"
                >
                  <Label htmlFor={`color-${key}`} className="text-center text-sm">
                    {label}
                  </Label>
                  <div
                    className="relative size-[50px] shrink-0 rounded-full outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background"
                  >
                    <input
                      id={`color-${key}`}
                      type="color"
                      className="absolute inset-0 z-10 size-[50px] min-h-0 cursor-pointer rounded-full opacity-0"
                      value={displayHex ?? "#ffffff"}
                      onChange={(e) =>
                        setKit({ ...kit, [key]: e.target.value } as BrandingKit)
                      }
                      aria-label={`${label} color picker`}
                    />
                    <div
                      className={cn(
                        "pointer-events-none absolute inset-0 rounded-full border-2 border-border shadow-sm",
                        !value.trim() && "border-dashed border-muted-foreground/40",
                      )}
                      style={{
                        backgroundColor: displayHex ?? "var(--muted)",
                      }}
                      aria-hidden
                    />
                  </div>
                  <span className="text-muted-foreground font-mono text-[11px] tabular-nums tracking-tight">
                    {displayHex ?? "—"}
                  </span>
                </div>
              );
            })}
            {kit.extraPaletteColors.map((value, idx) => {
              const displayHex = normalizeHexForPicker(value);
              return (
                <div
                  key={`extra-${idx}`}
                  className="flex w-[72px] flex-col items-center gap-2.5"
                >
                  <Label htmlFor={`color-extra-${idx}`} className="text-center text-sm">
                    Colour {idx + 4}
                  </Label>
                  <div className="relative shrink-0">
                    <div
                      className="relative size-[50px] rounded-full outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background"
                    >
                      <input
                        id={`color-extra-${idx}`}
                        type="color"
                        className="absolute inset-0 z-10 size-[50px] min-h-0 cursor-pointer rounded-full opacity-0"
                        value={displayHex}
                        onChange={(e) => {
                          const next = [...kit.extraPaletteColors];
                          next[idx] = e.target.value;
                          setKit({ ...kit, extraPaletteColors: next });
                        }}
                        aria-label={`Colour ${idx + 4} picker`}
                      />
                      <div
                        className="pointer-events-none absolute inset-0 rounded-full border-2 border-border shadow-sm"
                        style={{ backgroundColor: displayHex }}
                        aria-hidden
                      />
                    </div>
                    <button
                      type="button"
                      disabled={saving}
                      className="border-border bg-background text-muted-foreground hover:text-destructive absolute -top-1 -right-1 z-20 flex size-5 items-center justify-center rounded-full border shadow-sm disabled:pointer-events-none disabled:opacity-40"
                      onClick={() => void removeExtraPaletteColorAt(idx)}
                      aria-label={`Remove colour ${idx + 4}`}
                    >
                      <X className="size-3" aria-hidden />
                    </button>
                  </div>
                  <span className="text-muted-foreground font-mono text-[11px] tabular-nums tracking-tight">
                    {displayHex}
                  </span>
                </div>
              );
            })}
            <div className="flex w-[72px] flex-col items-center gap-2.5">
              <span className="text-muted-foreground text-center text-sm">
                Add colour
              </span>
              <Popover
                open={addColorOpen}
                onOpenChange={(open) => {
                  setAddColorOpen(open);
                  if (open) setAddColorHexDraft("#000000");
                }}
              >
                <PopoverTrigger
                  type="button"
                  disabled={
                    saving ||
                    kit.extraPaletteColors.length >= MAX_EXTRA_PALETTE_COLORS
                  }
                  className="flex size-[50px] shrink-0 items-center justify-center rounded-full border border-black bg-white text-black shadow-sm transition-[transform,box-shadow] outline-none hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
                  aria-label="Add colour"
                  title={
                    kit.extraPaletteColors.length >= MAX_EXTRA_PALETTE_COLORS
                      ? `At most ${MAX_EXTRA_PALETTE_COLORS} extra colours`
                      : "Add colour"
                  }
                >
                  <Plus className="size-5" strokeWidth={2.5} aria-hidden />
                </PopoverTrigger>
                <PopoverContent side="top" align="center" className="w-72">
                  <div className="space-y-3">
                    <p className="text-foreground text-sm font-semibold">
                      Add hex colour
                    </p>
                    <div className="flex items-center gap-3">
                      <div
                        className="border-border size-10 shrink-0 rounded-full border-2 shadow-inner"
                        style={{
                          backgroundColor:
                            parseHexString(addColorHexDraft) ?? "transparent",
                        }}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <Label htmlFor="add-palette-hex" className="text-xs">
                          Hex value
                        </Label>
                        <Input
                          id="add-palette-hex"
                          value={addColorHexDraft}
                          onChange={(e) => setAddColorHexDraft(e.target.value)}
                          placeholder="#1a1a1a or #abc"
                          className="font-mono text-sm"
                          autoComplete="off"
                          spellCheck={false}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void commitAddExtraPaletteColor();
                            }
                          }}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={saving}
                        onClick={() => setAddColorOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={saving}
                        onClick={() => void commitAddExtraPaletteColor()}
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              <span className="text-muted-foreground invisible text-[11px]">—</span>
            </div>
          </div>
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
          <div className="space-y-2 pt-2">
            <Label htmlFor="voice-tone-tags">Tone tags</Label>
            <Input
              id="voice-tone-tags"
              value={(kit.voiceToneTags ?? []).join(", ")}
              onChange={(e) =>
                setKit({
                  ...kit,
                  voiceToneTags: normalizeVoiceToneTags(
                    e.target.value.split(",").map((s) => s.trim()),
                  ),
                })
              }
              placeholder="e.g. direct, playful, premium — comma-separated"
              autoComplete="off"
            />
            <p className="text-muted-foreground text-xs leading-relaxed">
              Short labels merged into prompts to steer copy style (max{" "}
              {MAX_VOICE_TONE_TAGS} tags).
            </p>
          </div>
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
            Brand marks
          </CardTitle>
          <CardDescription>
            Optional reference images sent during generation (after your product
            photo): primary lockup, alternate secondary lockup, and square icon. Each
            file is stored privately in your Supabase bucket (max{" "}
            {MAX_LOGO_BYTES / (1024 * 1024)} MB, JPEG / PNG / WebP).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <section className="space-y-4">
            <div>
              <h3 className="text-foreground text-sm font-semibold">Primary logo</h3>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                Default horizontal or stacked lockup — the main mark the model should
                match for placement and clear space.
              </p>
            </div>
            {logoPreviewUrl ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="relative h-24 w-40 overflow-hidden rounded-lg border bg-muted/30">
                  <Image
                    src={logoPreviewUrl}
                    alt="Primary brand logo preview"
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
                  {pendingLogoFile ? "Discard pending file" : "Remove on next Save"}
                </Button>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="brand-logo-upload">Upload primary logo</Label>
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
                  Pending:{" "}
                  <span className="font-medium">{pendingLogoFile.name}</span> — click
                  Save branding to upload.
                </p>
              ) : null}
            </div>
          </section>

          <section className="border-border space-y-4 border-t pt-6">
            <div>
              <h3 className="text-foreground flex items-center gap-2 text-sm font-semibold">
                <Images className="size-4 shrink-0" aria-hidden />
                Secondary logo
              </h3>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                Alternate lockup (e.g. wordmark-only or reversed treatment) when the
                primary mark does not fit the layout.
              </p>
            </div>
            {secondaryLogoPreviewUrl ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="relative h-24 w-40 overflow-hidden rounded-lg border bg-muted/30">
                  <Image
                    src={secondaryLogoPreviewUrl}
                    alt="Secondary brand logo preview"
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
                  onClick={() => onSecondaryLogoChosen(null)}
                >
                  <Trash2 className="size-4" aria-hidden />
                  {pendingSecondaryLogoFile
                    ? "Discard pending file"
                    : "Remove on next Save"}
                </Button>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="brand-secondary-logo-upload">Upload secondary logo</Label>
              <Input
                id="brand-secondary-logo-upload"
                type="file"
                accept={LOGO_ACCEPT}
                className="cursor-pointer"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  onSecondaryLogoChosen(f ?? null);
                  e.target.value = "";
                }}
              />
              {pendingSecondaryLogoFile ? (
                <p className="text-muted-foreground text-xs">
                  Pending:{" "}
                  <span className="font-medium">{pendingSecondaryLogoFile.name}</span>{" "}
                  — click Save branding to upload.
                </p>
              ) : null}
            </div>
          </section>

          <section className="border-border space-y-4 border-t pt-6">
            <div>
              <h3 className="text-foreground flex items-center gap-2 text-sm font-semibold">
                <Shapes className="size-4 shrink-0" aria-hidden />
                Icon
              </h3>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                Square mark, app icon, or monogram — useful for tight crops and
                favicon-style placements.
              </p>
            </div>
            {iconPreviewUrl ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="relative size-24 overflow-hidden rounded-lg border bg-muted/30">
                  <Image
                    src={iconPreviewUrl}
                    alt="Brand icon preview"
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
                  onClick={() => onIconChosen(null)}
                >
                  <Trash2 className="size-4" aria-hidden />
                  {pendingIconFile ? "Discard pending file" : "Remove on next Save"}
                </Button>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="brand-icon-upload">Upload icon</Label>
              <Input
                id="brand-icon-upload"
                type="file"
                accept={LOGO_ACCEPT}
                className="cursor-pointer"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  onIconChosen(f ?? null);
                  e.target.value = "";
                }}
              />
              {pendingIconFile ? (
                <p className="text-muted-foreground text-xs">
                  Pending:{" "}
                  <span className="font-medium">{pendingIconFile.name}</span> — click
                  Save branding to upload.
                </p>
              ) : null}
            </div>
          </section>
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
