import { generateText, Output } from "ai";
import { z } from "zod";

const pdfBrandingSchema = z.object({
  brandName: z
    .string()
    .max(200)
    .optional()
    .describe(
      "Official brand or product name as written in the guide. Omit if not stated clearly.",
    ),
  tagline: z
    .string()
    .max(500)
    .optional()
    .describe(
      "Primary tagline, positioning line, or brand promise from the document. Omit if absent.",
    ),
  primaryColor: z
    .string()
    .max(16)
    .optional()
    .describe(
      "Primary brand color as #RGB or #RRGGBB only if explicitly specified (swatches, hex codes). Otherwise omit.",
    ),
  secondaryColor: z
    .string()
    .max(16)
    .optional()
    .describe(
      "Secondary/support color as #RGB or #RRGGBB only if explicitly specified. Otherwise omit.",
    ),
  accentColor: z
    .string()
    .max(16)
    .optional()
    .describe(
      "Accent or highlight color as #RGB or #RRGGBB only if explicitly specified. Otherwise omit.",
    ),
  headingFontName: z
    .string()
    .max(120)
    .optional()
    .describe(
      "Display or heading typeface family name exactly as the guide names it (e.g. 'Inter', 'GT America Extended'). Omit if not specified.",
    ),
  bodyFontName: z
    .string()
    .max(120)
    .optional()
    .describe(
      "Body or UI typeface family name as stated in the guide. Omit if not specified.",
    ),
  voiceTone: z
    .string()
    .max(2000)
    .optional()
    .describe(
      "Voice, tone, and copy style rules distilled from the guide (2–8 sentences). Base only on what the PDF states.",
    ),
  voiceToneTags: z
    .array(z.string().max(40))
    .max(12)
    .optional()
    .describe(
      "Short tone labels explicitly stated or strongly implied in the guide (e.g. bold, minimalist). Omit if not grounded in the document.",
    ),
  extraNotes: z
    .string()
    .max(4000)
    .optional()
    .describe(
      "Logo usage, clear space, imagery, layout grids, motion, accessibility, or do/don't lists relevant to ad creatives. Omit if nothing concrete.",
    ),
});

export type PdfBrandingExtraction = z.infer<typeof pdfBrandingSchema>;

const DEFAULT_BRAND_IMPORT_MODEL = "openai/gpt-5-mini";

export async function extractBrandingFromPdfText(params: {
  text: string;
  pageCount: number;
}): Promise<
  { ok: true; data: PdfBrandingExtraction } | { ok: false; error: string }
> {
  const model =
    process.env.BRAND_IMPORT_MODEL?.trim() || DEFAULT_BRAND_IMPORT_MODEL;

  const userPrompt = [
    "You are reading text extracted from a brand guidelines PDF (order may not be perfect).",
    `Approximate source length: ${params.text.length} characters from about ${params.pageCount} page(s).`,
    "",
    "--- Extracted PDF text ---",
    params.text,
  ].join("\n");

  try {
    const { output } = await generateText({
      model,
      output: Output.object({
        schema: pdfBrandingSchema,
        name: "brand_kit_from_pdf",
        description:
          "Structured brand kit fields inferred only from brand guideline PDF text.",
      }),
      system: [
        "You extract structured branding data for paid-social ad production.",
        "Rules:",
        "- Use ONLY information supported by the PDF text. Never invent awards, statistics, partnerships, or trademark claims.",
        "- For colors: output valid #RGB or #RRGGBB hex only when the document gives hex, RGB, CMYK-to-hex, or named swatches with explicit values. If unsure, omit the color field.",
        "- For fonts: use the family name as printed (e.g. 'Helvetica Neue' or 'Inter'). Do not guess weights unless named as separate families.",
        "- Prefer omitting optional fields over weak guesses.",
        "- If the excerpt is clearly not a brand guide (wrong file), omit most fields.",
      ].join("\n"),
      prompt: userPrompt,
      providerOptions: {
        gateway: {
          tags: ["feature:brand-import-pdf"],
        },
      },
      maxOutputTokens: 2500,
    });

    return { ok: true, data: output ?? {} };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "PDF branding extraction failed";
    return { ok: false, error: msg };
  }
}
