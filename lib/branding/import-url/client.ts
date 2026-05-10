import type { BrandingKitView } from "@/lib/branding/types";

export type ImportBrandingFromUrlResult =
  | { ok: true; view: BrandingKitView; warnings: string[] }
  | { ok: false; error: string; status?: number };

export async function importBrandingFromUrl(
  url: string,
): Promise<ImportBrandingFromUrlResult> {
  const trimmed = url.trim();
  if (!trimmed) {
    return { ok: false, error: "Enter a website URL." };
  }
  try {
    const res = await fetch("/api/branding/import-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: trimmed }),
    });
    const data = (await res.json()) as {
      view?: BrandingKitView;
      warnings?: string[];
      error?: string;
    };
    if (!res.ok) {
      return {
        ok: false,
        error: data.error ?? "Could not import from this URL.",
        status: res.status,
      };
    }
    if (!data.view) {
      return { ok: false, error: "Unexpected response from import." };
    }
    return { ok: true, view: data.view, warnings: data.warnings ?? [] };
  } catch {
    return { ok: false, error: "Network error while importing." };
  }
}
