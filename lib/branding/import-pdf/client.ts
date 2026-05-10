import type { BrandingKitView } from "@/lib/branding/types";

export async function importBrandingFromPdf(file: File): Promise<
  | { ok: true; view: BrandingKitView; warnings: string[] }
  | { ok: false; error: string }
> {
  const form = new FormData();
  form.set("pdf", file);

  try {
    const res = await fetch("/api/branding/import-pdf", {
      method: "POST",
      body: form,
    });
    const data = (await res.json()) as {
      view?: BrandingKitView;
      warnings?: string[];
      error?: string;
    };

    if (!res.ok) {
      return {
        ok: false,
        error: data.error ?? "Could not import from this PDF.",
      };
    }
    if (!data.view) {
      return { ok: false, error: "Unexpected response from import." };
    }
    return {
      ok: true,
      view: data.view,
      warnings: Array.isArray(data.warnings) ? data.warnings : [],
    };
  } catch {
    return { ok: false, error: "Network error while importing PDF." };
  }
}
