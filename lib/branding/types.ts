export type TypographySlotKind = "manual" | "google" | "custom";

/**
 * Typography slot, asset-free. Custom-font binary, when present, lives in
 * Supabase Storage and is referenced separately via the kit-view URLs / paths.
 */
export type TypographySlot = {
  kind: TypographySlotKind;
  /** Free-form description when kind is manual */
  manual: string;
  /** Google Font family name when kind is google */
  googleFamily: string;
  /** Display name for custom font (used in prompts and CSS) */
  customFamily: string;
};

export function emptyTypographySlot(): TypographySlot {
  return {
    kind: "manual",
    manual: "",
    googleFamily: "",
    customFamily: "",
  };
}

/**
 * Canonical, asset-free shape that mirrors a `branding_kits` row. JSON-safe
 * and what we send/receive on the wire. Binary references (logo, custom fonts)
 * are surfaced separately via {@link BrandingKitView}.
 */
export type BrandingKit = {
  version: 2;
  brandName: string;
  tagline: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  /** Additional palette swatches beyond primary / secondary / accent. */
  extraPaletteColors: string[];
  headingTypography: TypographySlot;
  bodyTypography: TypographySlot;
  voiceTone: string;
  /** Short labels for steering copy tone (e.g. playful, direct); used in prompts. */
  voiceToneTags: string[];
  extraNotes: string;
};

export const DEFAULT_BRANDING_KIT: BrandingKit = {
  version: 2,
  brandName: "",
  tagline: "",
  primaryColor: "",
  secondaryColor: "",
  accentColor: "",
  extraPaletteColors: [],
  headingTypography: emptyTypographySlot(),
  bodyTypography: emptyTypographySlot(),
  voiceTone: "",
  voiceToneTags: [],
  extraNotes: "",
};

/**
 * Hydrated kit returned to the client. URLs are short-lived signed URLs to
 * objects in the private branding-assets bucket; mediaTypes mirror what the
 * server stored.
 */
export type BrandingKitView = {
  kit: BrandingKit;
  /** Primary / default lockup (historically `logo_*` in the database). */
  logoUrl: string | null;
  logoMediaType: string | null;
  secondaryLogoUrl: string | null;
  secondaryLogoMediaType: string | null;
  iconUrl: string | null;
  iconMediaType: string | null;
  headingFontUrl: string | null;
  headingFontMediaType: string | null;
  bodyFontUrl: string | null;
  bodyFontMediaType: string | null;
};

export const DEFAULT_BRANDING_KIT_VIEW: BrandingKitView = {
  kit: DEFAULT_BRANDING_KIT,
  logoUrl: null,
  logoMediaType: null,
  secondaryLogoUrl: null,
  secondaryLogoMediaType: null,
  iconUrl: null,
  iconMediaType: null,
  headingFontUrl: null,
  headingFontMediaType: null,
  bodyFontUrl: null,
  bodyFontMediaType: null,
};

/**
 * Minimal metadata used by the generate / sidebar surfaces to render the
 * "Using: name · palette · …" preview without shipping the full kit.
 */
export type BrandingKitMeta = {
  hasContent: boolean;
  brandName: string;
  hasPalette: boolean;
  hasTypography: boolean;
  hasVoiceTone: boolean;
  hasVoiceToneTags: boolean;
  hasExtraNotes: boolean;
  /** True if any of primary, secondary, or icon mark is present. */
  hasLogo: boolean;
  hasPrimaryLogo: boolean;
  hasSecondaryLogo: boolean;
  hasIcon: boolean;
};

export const EMPTY_BRANDING_KIT_META: BrandingKitMeta = {
  hasContent: false,
  brandName: "",
  hasPalette: false,
  hasTypography: false,
  hasVoiceTone: false,
  hasVoiceToneTags: false,
  hasExtraNotes: false,
  hasLogo: false,
  hasPrimaryLogo: false,
  hasSecondaryLogo: false,
  hasIcon: false,
};
