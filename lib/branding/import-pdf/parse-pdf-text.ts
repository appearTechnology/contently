import "server-only";
import { PDFParse } from "pdf-parse";

const MAX_CHARS_FOR_MODEL = 72_000;

export type ParseBrandGuidePdfResult =
  | {
      ok: true;
      textForModel: string;
      pageCount: number;
      truncated: boolean;
      rawCharCount: number;
    }
  | { ok: false; error: string };

/**
 * Extract plain text from a PDF buffer for downstream LLM branding extraction.
 */
export async function parseBrandGuidePdf(
  buffer: Buffer,
): Promise<ParseBrandGuidePdfResult> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    const raw = result.text.replace(/\s+/g, " ").trim();
    const pageCount =
      typeof result.total === "number" && result.total > 0
        ? result.total
        : result.pages.length;
    if (!raw) {
      return {
        ok: false,
        error:
          "No extractable text was found in this PDF. Scanned or image-only brand guides need OCR before import.",
      };
    }
    const truncated = raw.length > MAX_CHARS_FOR_MODEL;
    const textForModel = truncated
      ? raw.slice(0, MAX_CHARS_FOR_MODEL)
      : raw;
    return {
      ok: true,
      textForModel,
      pageCount,
      truncated,
      rawCharCount: raw.length,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "PDF parse failed";
    if (/password|encrypt/i.test(msg)) {
      return {
        ok: false,
        error:
          "This PDF appears to be password-protected or encrypted. Export an unlocked copy and try again.",
      };
    }
    return { ok: false, error: msg };
  } finally {
    try {
      await parser.destroy();
    } catch {
      /* ignore */
    }
  }
}
