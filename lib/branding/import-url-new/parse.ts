import type { BrandDNA } from "@/lib/db/schema";

/**
 * Brand DNA shaped for the UI: JSON-stringified columns parsed back into
 * arrays, nullable text coerced to empty strings. Mirrors the row written by
 * the `/api/branding/import-url-new` route.
 */
export type ParsedBrandDNA = {
  id: string;
  url: string;
  brandName: string;
  industry: string;
  tagline: string;
  valueProposition: string;
  toneOfVoice: string[];
  brandPersonality: string[];
  targetAudience: string;
  keyMessages: string[];
  primaryColors: string[];
  secondaryColors: string[];
  fonts: string[];
  logoUrl: string | null;
  screenshotUrl: string | null;
  imageryStyle: string;
  layoutStyle: string;
};

function parseStringArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value
      .filter((v): v is string => typeof v === "string")
      .map((v) => v.trim())
      .map((v) => v.charAt(0).toUpperCase() + v.slice(1))
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** Normalize a `brand_dna` row (DB or API response) into {@link ParsedBrandDNA}. */
export function parseBrandDNARow(row: BrandDNA): ParsedBrandDNA {
  return {
    id: row.id,
    url: row.url,
    brandName: row.brandName ?? "",
    industry: row.industry ?? "",
    tagline: row.tagline ?? "",
    valueProposition: row.valueProposition ?? "",
    toneOfVoice: parseStringArray(row.toneOfVoice),
    brandPersonality: parseStringArray(row.brandPersonality),
    targetAudience: row.targetAudience ?? "",
    keyMessages: parseStringArray(row.keyMessages),
    primaryColors: parseStringArray(row.primaryColors).slice(0, 4),
    secondaryColors: parseStringArray(row.secondaryColors).slice(0, 4),
    fonts: parseStringArray(row.fonts).slice(0, 4),
    logoUrl: row.logoUrl ?? null,
    screenshotUrl: row.screenshotUrl ?? null,
    imageryStyle: row.imageryStyle ?? "",
    layoutStyle: row.layoutStyle ?? "",
  };
}
