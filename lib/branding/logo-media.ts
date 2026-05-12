/**
 * Raster formats accepted for logos in Storage — keep in sync with upload validation.
 */
export const ALLOWED_LOGO_MEDIA_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function isAllowedRasterLogoType(contentType: string): boolean {
  const ct = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  return ALLOWED_LOGO_MEDIA_TYPES.has(ct);
}
