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
  for (const x of kit.extraPaletteColors ?? []) {
    const c = clean(x);
    if (c) colors.push(c);
  }
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

  const tags = (kit.voiceToneTags ?? []).filter((t) => clean(t).length > 0);
  if (tags.length > 0) {
    lines.push(`Tone tags (steer copy style): ${tags.join(", ")}`);
  }

  const extra = clean(kit.extraNotes);
  if (extra) lines.push(`Additional brand notes:\n${extra}`);

  return lines.join("\n").trim();
}

export function hasBrandingContent(view: BrandingKitView): boolean {
  return (
    formatBrandingForPrompt(view).length > 0 ||
    Boolean(view.logoUrl || view.secondaryLogoUrl || view.iconUrl)
  );
}

/** Compact preview used by the generate UI without shipping the full view. */
export function brandingViewToMeta(view: BrandingKitView): BrandingKitMeta {
  const { kit } = view;
  const hasPalette = Boolean(
    clean(kit.primaryColor) ||
      clean(kit.secondaryColor) ||
      clean(kit.accentColor) ||
      (kit.extraPaletteColors ?? []).some((c) => clean(c).length > 0),
  );
  const hasTypography =
    typographySlotHasSelection(kit.headingTypography) ||
    typographySlotHasSelection(kit.bodyTypography);
  const hasVoiceTone = clean(kit.voiceTone).length > 0;
  const hasVoiceToneTags =
    Array.isArray(kit.voiceToneTags) &&
    (kit.voiceToneTags ?? []).some((t) => clean(t).length > 0);
  const hasExtraNotes = clean(kit.extraNotes).length > 0;
  const hasPrimaryLogo = Boolean(view.logoUrl);
  const hasSecondaryLogo = Boolean(view.secondaryLogoUrl);
  const hasIcon = Boolean(view.iconUrl);
  const hasLogo = hasPrimaryLogo || hasSecondaryLogo || hasIcon;
  const hasContent =
    hasPalette ||
    hasTypography ||
    hasVoiceTone ||
    hasVoiceToneTags ||
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
    hasVoiceToneTags,
    hasExtraNotes,
    hasLogo,
    hasPrimaryLogo,
    hasSecondaryLogo,
    hasIcon,
  };
}

/** Backwards-compat alias used by surfaces that already imported the kit form. */
export type { BrandingKit, BrandingKitView };
