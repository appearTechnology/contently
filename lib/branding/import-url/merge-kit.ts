import type { BrandingKit } from "@/lib/branding/types";
import { normalizeVoiceToneTags } from "@/lib/branding/voice-tone-tags";
import type { DeterministicExtraction } from "./extract";
import type { LlmEnrichment } from "./enrich-with-llm";

export function mergeImportedBranding(
  det: DeterministicExtraction,
  llm: LlmEnrichment | null,
): BrandingKit {
  const l = llm ?? {};
  return {
    version: 2,
    brandName: (l.brandName?.trim() || det.brandName).slice(0, 200),
    tagline: (l.tagline?.trim() || det.tagline).slice(0, 500),
    primaryColor: det.primaryColor,
    secondaryColor: det.secondaryColor,
    accentColor: det.accentColor,
    headingTypography: det.headingTypography,
    bodyTypography: det.bodyTypography,
    voiceTone: (l.voiceTone ?? "").trim().slice(0, 2000),
    voiceToneTags: normalizeVoiceToneTags(l.voiceToneTags),
    extraNotes: (l.extraNotes ?? "").trim().slice(0, 4000),
    extraPaletteColors: [],
  };
}
