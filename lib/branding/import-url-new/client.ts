import type { BrandDNA } from "@/lib/db/schema";
import { parseBrandDNARow, type ParsedBrandDNA } from "./parse";

export type ImportBrandDnaResult =
  | { ok: true; dna: ParsedBrandDNA }
  | { ok: false; error: string; status?: number };

/**
 * Analyze a website via `/api/branding/import-url-new`. The route scrapes,
 * runs the AI brand analysis, upserts the `brand_dna` row, and returns it.
 */
export async function importBrandDnaFromUrl(
  url: string,
): Promise<ImportBrandDnaResult> {
  const trimmed = url.trim();
  if (!trimmed) {
    return { ok: false, error: "Enter a website URL." };
  }
  try {
    const res = await fetch("/api/branding/import-url-new", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: trimmed }),
    });
    const data = (await res.json()) as Partial<BrandDNA> & { error?: string };
    if (!res.ok) {
      return {
        ok: false,
        error: data.error ?? "Could not analyze this URL.",
        status: res.status,
      };
    }
    if (!data.id) {
      return { ok: false, error: "Unexpected response from analysis." };
    }
    return { ok: true, dna: parseBrandDNARow(data as BrandDNA) };
  } catch {
    return { ok: false, error: "Network error while analyzing." };
  }
}
