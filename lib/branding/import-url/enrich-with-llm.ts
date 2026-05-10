import { generateText, Output } from "ai";
import { z } from "zod";
import type { DeterministicExtraction } from "./extract";

export type LlmEnrichment = {
  brandName?: string;
  tagline?: string;
  voiceTone?: string;
  extraNotes?: string;
};

const enrichmentSchema = z.object({
  brandName: z
    .string()
    .max(200)
    .optional()
    .describe(
      "Clean brand display name only if the extracted name looks like a raw domain, boilerplate title suffix, or unclear fragment; otherwise omit this field.",
    ),
  tagline: z
    .string()
    .max(320)
    .optional()
    .describe(
      "Short marketing tagline or hero value proposition from the page. Omit if nothing credible can be inferred.",
    ),
  voiceTone: z
    .string()
    .max(1200)
    .optional()
    .describe(
      "Concise voice and tone guidelines for ad copy (2–5 sentences). Base only on observable language from the provided text; do not invent product claims.",
    ),
  extraNotes: z
    .string()
    .max(1200)
    .optional()
    .describe(
      "Optional layout/branding notes inferred from content (e.g. emphasis on simplicity, premium cues). Omit if unsure.",
    ),
});

const DEFAULT_BRAND_IMPORT_MODEL = "openai/gpt-5-mini";

export async function enrichBrandingWithLLM(params: {
  deterministic: DeterministicExtraction;
}): Promise<{ ok: true; data: LlmEnrichment } | { ok: false; error: string }> {
  const model =
    process.env.BRAND_IMPORT_MODEL?.trim() || DEFAULT_BRAND_IMPORT_MODEL;

  const textSample = params.deterministic.visibleTextForLLM.slice(0, 8000);
  const summary = params.deterministic.deterministicSummary.slice(0, 4000);

  const userPrompt = [
    "Infer branding guidance for paid-social ad creation.",
    "",
    "--- Extracted signals ---",
    summary,
    "",
    "--- Visible page text (truncated) ---",
    textSample,
  ].join("\n");

  try {
    const { output } = await generateText({
      model,
      output: Output.object({
        schema: enrichmentSchema,
        name: "brand_kit_enrichment",
        description: "Structured brand copy derived from a public webpage.",
      }),
      system: [
        "You help fill a brand kit from webpage content.",
        "Rules:",
        "- Never invent specific product claims, statistics, awards, or partnerships.",
        "- Prefer omitting optional fields over guessing.",
        "- Voice/tone should describe how the brand sounds based on wording on the page.",
        "- Keep outputs concise and usable as brief prompts for designers.",
      ].join("\n"),
      prompt: userPrompt,
      providerOptions: {
        gateway: {
          tags: ["feature:brand-import"],
        },
      },
      maxOutputTokens: 1200,
    });

    return { ok: true, data: output ?? {} };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "LLM enrichment failed";
    return { ok: false, error: msg };
  }
}
