import type { BrandingKit } from "@/lib/branding/types";
import { typographySlotForFamily } from "@/lib/branding/typography-slot-for-family";
import type { PdfBrandingExtraction } from "./extract-with-llm";

function normalizeHexInput(raw: string | undefined): string {
  if (!raw) return "";
  const t = raw.trim();
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(t);
  if (!m?.[1]) return "";
  let h = m[1];
  if (h.length === 3) {
    h = `${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
  }
  return `#${h.toLowerCase()}`;
}

function hasAnyPdfField(pdf: PdfBrandingExtraction): boolean {
  return Boolean(
    pdf.brandName?.trim() ||
      pdf.tagline?.trim() ||
      pdf.primaryColor?.trim() ||
      pdf.secondaryColor?.trim() ||
      pdf.accentColor?.trim() ||
      pdf.headingFontName?.trim() ||
      pdf.bodyFontName?.trim() ||
      pdf.voiceTone?.trim() ||
      pdf.extraNotes?.trim(),
  );
}

/**
 * Non-destructive merge: each field is updated from the PDF extraction only when
 * the model returned a non-empty value; otherwise the existing kit value is kept.
 */
export function mergePdfBrandingIntoExistingKit(
  existing: BrandingKit,
  pdf: PdfBrandingExtraction,
): { kit: BrandingKit; inferredAny: boolean } {
  const inferredAny = hasAnyPdfField(pdf);

  const brandName = pdf.brandName?.trim();
  const tagline = pdf.tagline?.trim();
  const p1 = normalizeHexInput(pdf.primaryColor);
  const p2 = normalizeHexInput(pdf.secondaryColor);
  const p3 = normalizeHexInput(pdf.accentColor);
  const headingName = pdf.headingFontName?.trim();
  const bodyName = pdf.bodyFontName?.trim();
  const voice = pdf.voiceTone?.trim();
  const notes = pdf.extraNotes?.trim();

  return {
    inferredAny,
    kit: {
      version: 2,
      brandName:
        brandName && brandName.length > 0
          ? brandName.slice(0, 200)
          : existing.brandName,
      tagline:
        tagline && tagline.length > 0
          ? tagline.slice(0, 500)
          : existing.tagline,
      primaryColor: p1 || existing.primaryColor,
      secondaryColor: p2 || existing.secondaryColor,
      accentColor: p3 || existing.accentColor,
      headingTypography: headingName
        ? typographySlotForFamily(headingName)
        : existing.headingTypography,
      bodyTypography: bodyName
        ? typographySlotForFamily(bodyName)
        : existing.bodyTypography,
      voiceTone:
        voice && voice.length > 0
          ? voice.slice(0, 2000)
          : existing.voiceTone,
      extraNotes:
        notes && notes.length > 0
          ? notes.slice(0, 4000)
          : existing.extraNotes,
    },
  };
}
