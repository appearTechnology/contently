import type {
  BrandingKit,
  BrandingKitMeta,
  BrandingKitView,
  TypographySlot,
} from "@/lib/branding/types";

function clean(s: string): string {
  return s.trim();
}

export function typographySlotHasSelection(slot: TypographySlot): boolean {
  if (slot.kind === "manual") return clean(slot.manual).length > 0;
  if (slot.kind === "google") return clean(slot.googleFamily).length > 0;
  return clean(slot.customFamily).length > 0;
}

function formatTypographyLine(
  label: string,
  slot: TypographySlot,
  hasCustomFile: boolean,
): string | null {
  if (slot.kind === "manual") {
    const t = clean(slot.manual);
    return t ? `${label}: ${t}` : null;
  }
  if (slot.kind === "google") {
    const fam = clean(slot.googleFamily);
    return fam ? `${label}: ${fam} (Google Font)` : null;
  }
  const fam = clean(slot.customFamily);
  if (!hasCustomFile && !fam) return null;
  const name = fam || "Custom brand font";
  return `${label}: ${name} (custom uploaded font — approximate letterforms and weight)`;
}

/**
 * Human-readable block injected into ad generation when branding is enabled.
 * `view` provides per-asset hints so we can mention custom fonts even before
 * the family name is filled in.
 */
export function formatBrandingForPrompt(view: BrandingKitView): string {
  const { kit } = view;
  const lines: string[] = [];

  const name = clean(kit.brandName);
  const tagline = clean(kit.tagline);
  if (name) lines.push(`Brand name: ${name}`);
  if (tagline) lines.push(`Tagline / lockup text: ${tagline}`);

  const colors: string[] = [];
  const p = clean(kit.primaryColor);
  const s = clean(kit.secondaryColor);
  const a = clean(kit.accentColor);
  if (p) colors.push(`primary ${p}`);
  if (s) colors.push(`secondary ${s}`);
  if (a) colors.push(`accent ${a}`);
  if (colors.length) lines.push(`Palette: ${colors.join(", ")}`);

  const headingLine = formatTypographyLine(
    "Heading typography",
    kit.headingTypography,
    Boolean(view.headingFontUrl),
  );
  if (headingLine) lines.push(headingLine);
  const bodyLine = formatTypographyLine(
    "Body typography",
    kit.bodyTypography,
    Boolean(view.bodyFontUrl),
  );
  if (bodyLine) lines.push(bodyLine);

  const voice = clean(kit.voiceTone);
  if (voice) lines.push(`Voice & tone:\n${voice}`);

  const extra = clean(kit.extraNotes);
  if (extra) lines.push(`Additional brand notes:\n${extra}`);

  return lines.join("\n").trim();
}

export function hasBrandingContent(view: BrandingKitView): boolean {
  return formatBrandingForPrompt(view).length > 0 || Boolean(view.logoUrl);
}

/** Compact preview used by the generate UI without shipping the full view. */
export function brandingViewToMeta(view: BrandingKitView): BrandingKitMeta {
  const { kit } = view;
  const hasPalette = Boolean(
    clean(kit.primaryColor) || clean(kit.secondaryColor) || clean(kit.accentColor),
  );
  const hasTypography =
    typographySlotHasSelection(kit.headingTypography) ||
    typographySlotHasSelection(kit.bodyTypography);
  const hasVoiceTone = clean(kit.voiceTone).length > 0;
  const hasExtraNotes = clean(kit.extraNotes).length > 0;
  const hasLogo = Boolean(view.logoUrl);
  const hasContent =
    hasPalette ||
    hasTypography ||
    hasVoiceTone ||
    hasExtraNotes ||
    hasLogo ||
    clean(kit.brandName).length > 0 ||
    clean(kit.tagline).length > 0;
  return {
    hasContent,
    brandName: clean(kit.brandName),
    hasPalette,
    hasTypography,
    hasVoiceTone,
    hasExtraNotes,
    hasLogo,
  };
}

/** Backwards-compat alias used by surfaces that already imported the kit form. */
export type { BrandingKit, BrandingKitView };
