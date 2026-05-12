"use client";

import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { googleFontStylesheetHref, GOOGLE_FONT_FAMILIES } from "@/lib/branding/google-fonts";
import type { TypographySlot, TypographySlotKind } from "@/lib/branding/types";
import { cn } from "@/lib/utils";

const FONT_ACCEPT = ".woff2,.woff,.ttf,.otf";
const MAX_FONT_BYTES = 2 * 1024 * 1024;
const NONE_GOOGLE = "__none__";

function isFontFile(file: File): boolean {
  const n = file.name.toLowerCase();
  return (
    n.endsWith(".woff2") ||
    n.endsWith(".woff") ||
    n.endsWith(".ttf") ||
    n.endsWith(".otf")
  );
}

function cssFontFormatFromMediaType(type: string): string {
  if (type === "font/woff2") return "woff2";
  if (type === "font/woff") return "woff";
  if (type === "font/ttf" || type === "application/x-font-ttf") return "truetype";
  if (type === "font/otf" || type === "application/x-font-otf") return "opentype";
  return "woff2";
}

function cssFontFormatFromFilename(name: string): string {
  const n = name.toLowerCase();
  if (n.endsWith(".woff2")) return "woff2";
  if (n.endsWith(".woff")) return "woff";
  if (n.endsWith(".ttf")) return "truetype";
  if (n.endsWith(".otf")) return "opentype";
  return "woff2";
}

function cssSafeFamilyName(name: string, fallback: string): string {
  const base = name.trim() || fallback;
  return base.replace(/['"\\]/g, "");
}

export function BrandingTypographySlot({
  label,
  slotKey,
  slot,
  onChange,
  previewSize,
  /** Persisted custom-font URL from Supabase (signed). */
  customFontUrl,
  customFontMediaType,
  pendingFontFile,
  onFontFileChosen,
  onClearFont,
}: {
  label: string;
  slotKey: "heading" | "body";
  slot: TypographySlot;
  onChange: (next: TypographySlot) => void;
  previewSize: "heading" | "body";
  /** Persisted custom-font URL from Supabase (signed). */
  customFontUrl: string | null;
  customFontMediaType: string | null;
  /** Pending File chosen but not yet uploaded; preview uses this directly. */
  pendingFontFile: File | null;
  onFontFileChosen: (next: File) => void;
  /** Discard pending file OR mark saved font for removal on next Save. */
  onClearFont: () => void;
}) {
  const customBlobUrlRef = useRef<string | null>(null);
  const pendingPreviewUrl = useMemo(
    () => (pendingFontFile ? URL.createObjectURL(pendingFontFile) : null),
    [pendingFontFile],
  );
  useEffect(() => {
    if (!pendingPreviewUrl) return;
    return () => URL.revokeObjectURL(pendingPreviewUrl);
  }, [pendingPreviewUrl]);

  useEffect(() => {
    if (slot.kind !== "google" || !slot.googleFamily.trim()) return;
    const href = googleFontStylesheetHref(slot.googleFamily);
    if (document.querySelector(`link[data-brand-gf="${href}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.setAttribute("data-brand-gf", href);
    document.head.appendChild(link);
  }, [slot.kind, slot.googleFamily]);

  useEffect(() => {
    const styleId = `brand-font-face-${slotKey}`;
    let cancelled = false;

    const revokeAndRemove = () => {
      document.getElementById(styleId)?.remove();
      if (customBlobUrlRef.current) {
        URL.revokeObjectURL(customBlobUrlRef.current);
        customBlobUrlRef.current = null;
      }
    };

    if (slot.kind !== "custom") {
      revokeAndRemove();
      return;
    }

    let format: string | null = null;
    let cssUrl: string | null = null;

    if (pendingFontFile && pendingPreviewUrl) {
      format = cssFontFormatFromFilename(pendingFontFile.name);
      cssUrl = pendingPreviewUrl;
    } else if (customFontUrl) {
      format = customFontMediaType
        ? cssFontFormatFromMediaType(customFontMediaType)
        : "woff2";
      cssUrl = customFontUrl;
    }

    if (!cssUrl || !format) {
      revokeAndRemove();
      return;
    }

    revokeAndRemove();
    const family = cssSafeFamilyName(slot.customFamily, `BrandFont${slotKey}`);
    const el = document.createElement("style");
    el.id = styleId;
    el.textContent = `@font-face{font-family:'${family.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}';src:url(${JSON.stringify(cssUrl)}) format('${format}');font-display:swap;}`;
    document.head.appendChild(el);

    return () => {
      if (cancelled) return;
      cancelled = true;
      revokeAndRemove();
    };
  }, [
    slot.kind,
    slot.customFamily,
    slotKey,
    pendingFontFile,
    pendingPreviewUrl,
    customFontUrl,
    customFontMediaType,
  ]);

  const previewFamily = useMemo(() => {
    if (slot.kind === "google" && slot.googleFamily.trim()) {
      return `"${slot.googleFamily.trim()}", sans-serif`;
    }
    if (
      slot.kind === "custom" &&
      (pendingFontFile || customFontUrl) &&
      slot.customFamily.trim()
    ) {
      return `'${cssSafeFamilyName(slot.customFamily, `BrandFont${slotKey}`)}', sans-serif`;
    }
    return undefined;
  }, [
    slot.kind,
    slot.googleFamily,
    slot.customFamily,
    slotKey,
    pendingFontFile,
    customFontUrl,
  ]);

  /** Human-readable font name for labels / preview caption. */
  const resolvedFontName = useMemo(() => {
    if (slot.kind === "manual") {
      const line = slot.manual.trim().split(/\n/)[0]?.trim();
      return line.length > 0 ? line : null;
    }
    if (slot.kind === "google") {
      const g = slot.googleFamily.trim();
      return g.length > 0 ? g : null;
    }
    if (slot.kind === "custom") {
      const fam = slot.customFamily.trim();
      if (fam) return fam;
      if (pendingFontFile) {
        return pendingFontFile.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      }
      return null;
    }
    return null;
  }, [
    slot.kind,
    slot.manual,
    slot.googleFamily,
    slot.customFamily,
    pendingFontFile,
  ]);

  const onKindChange = (value: string | null) => {
    if (value !== "manual" && value !== "google" && value !== "custom") return;
    onChange({ ...slot, kind: value as TypographySlotKind });
  };

  const onGoogleChange = (value: string | null) => {
    if (value == null) return;
    const family = value === NONE_GOOGLE ? "" : value;
    onChange({ ...slot, googleFamily: family });
  };

  const onFontFile = (file: File) => {
    if (!isFontFile(file)) {
      toast.error("Use a .woff2, .woff, .ttf, or .otf font file.");
      return;
    }
    if (file.size > MAX_FONT_BYTES) {
      toast.error(`Font must be at most ${MAX_FONT_BYTES / (1024 * 1024)} MB.`);
      return;
    }
    onFontFileChosen(file);
    if (!slot.customFamily.trim()) {
      const inferred = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      onChange({ ...slot, customFamily: inferred });
    }
    toast.success("Font ready — click Save branding to upload.");
  };

  const idBase = `${slotKey}-typography`;
  const hasUploadedFont = Boolean(customFontUrl);
  const hasPendingFont = Boolean(pendingFontFile);

  return (
    <div className="space-y-3 rounded-lg border border-border/80 bg-muted/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-base font-medium">{label}</Label>
        <a
          href="https://fonts.google.com/"
          target="_blank"
          rel="noreferrer"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs underline-offset-4 hover:underline"
        >
          Browse Google Fonts
          <ExternalLink className="size-3" aria-hidden />
        </a>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idBase}-source`} className="text-muted-foreground text-xs">
          Source
        </Label>
        <Select value={slot.kind} onValueChange={onKindChange}>
          <SelectTrigger id={`${idBase}-source`} className="w-full max-w-md">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="manual">Describe manually</SelectItem>
            <SelectItem value="google">Google Font</SelectItem>
            <SelectItem value="custom">Upload custom font</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {slot.kind === "manual" ? (
        <div className="space-y-2">
          <Label htmlFor={`${idBase}-manual`}>Font name</Label>
          <Textarea
            id={`${idBase}-manual`}
            value={slot.manual}
            onChange={(e) => onChange({ ...slot, manual: e.target.value })}
            placeholder={
              previewSize === "heading"
                ? "e.g. Inter Display — geometric sans, tight tracking"
                : "e.g. Source Sans 3 — neutral sans, readable at small sizes"
            }
            rows={3}
            className="resize-y min-h-[72px]"
          />
        </div>
      ) : null}

      {slot.kind === "google" ? (
        <div className="space-y-2">
          <Label htmlFor={`${idBase}-google`}>Font name</Label>
          <Select
            value={slot.googleFamily.trim() ? slot.googleFamily : NONE_GOOGLE}
            onValueChange={onGoogleChange}
          >
            <SelectTrigger id={`${idBase}-google`} className="w-full max-w-md">
              <SelectValue placeholder="Select a font" />
            </SelectTrigger>
            <SelectContent className="max-h-[min(320px,50vh)]">
              <SelectItem value={NONE_GOOGLE}>Select a font…</SelectItem>
              {GOOGLE_FONT_FAMILIES.map((family) => (
                <SelectItem key={family} value={family}>
                  {family}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {slot.kind === "custom" ? (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor={`${idBase}-custom-upload`}>Font file</Label>
            <Input
              id={`${idBase}-custom-upload`}
              type="file"
              accept={FONT_ACCEPT}
              className="cursor-pointer"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFontFile(f);
                e.target.value = "";
              }}
            />
            <p className="text-muted-foreground text-xs">
              WOFF2 preferred · max {MAX_FONT_BYTES / (1024 * 1024)} MB · uploaded
              to your private Supabase bucket on Save.
            </p>
            {hasUploadedFont && !hasPendingFont ? (
              <p className="text-muted-foreground text-xs">
                A font is already saved for this slot. Pick another file to
                replace it on Save.
              </p>
            ) : null}
            {hasPendingFont ? (
              <p className="text-muted-foreground text-xs">
                Pending: <span className="font-medium">{pendingFontFile!.name}</span>{" "}
                — click Save branding to upload.
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${idBase}-custom-name`}>Font name</Label>
            <Input
              id={`${idBase}-custom-name`}
              value={slot.customFamily}
              onChange={(e) => onChange({ ...slot, customFamily: e.target.value })}
              placeholder="e.g. Brand Sans Display"
            />
          </div>
          {hasPendingFont || hasUploadedFont ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={onClearFont}
            >
              {hasPendingFont ? "Discard pending font" : "Clear saved font on next Save"}
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-muted-foreground text-xs font-medium">Preview</p>
        {resolvedFontName ? (
          <p className="text-foreground text-sm font-semibold tracking-tight">
            {resolvedFontName}
          </p>
        ) : (
          <p className="text-muted-foreground text-sm">No font name yet</p>
        )}
        <div
          className={cn(
            "rounded-md border bg-background px-3 py-3 text-foreground",
            previewSize === "heading" && "text-xl font-semibold tracking-tight sm:text-2xl",
            previewSize === "body" && "text-sm leading-relaxed sm:text-base",
          )}
          style={previewFamily ? { fontFamily: previewFamily } : undefined}
        >
          The quick brown fox jumps over the lazy dog. 0123456789
        </div>
      </div>
    </div>
  );
}
