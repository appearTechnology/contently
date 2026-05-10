/** Convert a data URL to a File for multipart uploads (client-only). */
export async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const type = blob.type || "image/png";
  return new File([blob], filename, { type });
}

export function logoFilenameFromDataUrl(dataUrl: string): string {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);/.exec(dataUrl);
  const t = m?.[1];
  if (t === "image/jpeg") return "brand-logo.jpg";
  if (t === "image/png") return "brand-logo.png";
  if (t === "image/webp") return "brand-logo.webp";
  return "brand-logo.png";
}

export type DataUrlBytes = { mediaType: string; bytes: Buffer };

/**
 * Server-side parser for `data:image/<sub>;base64,<payload>` strings.
 * Returns `null` for non-base64 / non-image / malformed inputs so callers can
 * skip silently instead of crashing the request.
 */
export function dataUrlToBytes(dataUrl: string): DataUrlBytes | null {
  const m = /^data:([a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(
    dataUrl.trim(),
  );
  if (!m) return null;
  const mediaType = m[1]!;
  try {
    const bytes = Buffer.from(m[2]!, "base64");
    if (bytes.byteLength === 0) return null;
    return { mediaType, bytes };
  } catch {
    return null;
  }
}

const IMAGE_MEDIA_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/gif": "gif",
};

export function imageExtensionFromMediaType(mediaType: string): string {
  return IMAGE_MEDIA_TO_EXT[mediaType.toLowerCase()] ?? "png";
}

const FONT_MEDIA_TO_EXT: Record<string, string> = {
  "font/woff2": "woff2",
  "font/woff": "woff",
  "font/ttf": "ttf",
  "font/otf": "otf",
  "application/font-woff2": "woff2",
  "application/font-woff": "woff",
  "application/x-font-ttf": "ttf",
  "application/x-font-otf": "otf",
};

export function fontExtensionFromMediaType(mediaType: string): string {
  return FONT_MEDIA_TO_EXT[mediaType.toLowerCase()] ?? "woff2";
}
