export const GENERATE_ACCEPT = "image/jpeg,image/png,image/webp";

/** Extra reference images beyond the primary product shot (API cap). */
export const MAX_REFERENCE_IMAGES = 5;

export type GenerateOutputFormat = "photo" | "video";

/**
 * Builds the multipart body for `POST /api/generate`. Branding (text + logo)
 * is no longer included here — the server reads it from Supabase using the
 * authenticated Supabase user id when `applyBranding === "1"`.
 */
export function buildGenerateCreativeFormData(params: {
  primaryImage: File;
  referenceImages?: File[];
  prompt: string;
  format: GenerateOutputFormat;
  modelId: string;
  applyBranding: boolean;
}): FormData {
  const {
    primaryImage,
    referenceImages = [],
    prompt,
    format,
    modelId,
    applyBranding,
  } = params;

  const form = new FormData();
  form.set("image", primaryImage);
  form.set("prompt", prompt.trim());
  form.set("format", format);
  form.set("modelId", modelId);
  form.set("applyBranding", applyBranding ? "1" : "0");

  for (const file of referenceImages.slice(0, MAX_REFERENCE_IMAGES)) {
    form.append("referenceImages", file);
  }

  return form;
}
