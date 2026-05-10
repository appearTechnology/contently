/**
 * Map known provider / gateway safety messages to stable API responses.
 * Many image models refuse inputs that may depict identifiable real people.
 */

function aggregateErrorText(err: unknown): string {
  const parts: string[] = [];
  let e: unknown = err;
  for (let depth = 0; depth < 6 && e; depth++) {
    if (e instanceof Error) {
      parts.push(e.message);
      e = (e as Error & { cause?: unknown }).cause;
    } else if (typeof e === "object" && e !== null && "message" in e) {
      const m = (e as { message?: unknown }).message;
      parts.push(typeof m === "string" ? m : JSON.stringify(e));
      break;
    } else {
      parts.push(String(e));
      break;
    }
  }
  return parts.join(" ");
}

export type MappedProviderError = {
  httpStatus: number;
  code: "INPUT_IMAGE_PERSON_POLICY";
  error: string;
};

/**
 * Returns a structured response when the failure is a known input-image
 * people / likeness policy block; otherwise `null` (caller uses generic 500).
 */
export function mapProviderGenerationError(
  err: unknown,
): MappedProviderError | null {
  const text = aggregateErrorText(err).toLowerCase();

  const looksLikePersonInputBlock =
    /\breal\s+person(s)?\b/.test(text) ||
    /\binput\s+image\b.*\bperson\b/.test(text) ||
    /\bcontain(s)?\b.*\b(real\s+)?(person|people|human)\b/.test(text) ||
    /\bhuman\s+(face|likeness|figure)\b/.test(text) ||
    /\brecognizable\s+(face|person)\b/.test(text) ||
    /\bphotorealistic\s+(human|person|face)\b/.test(text);

  if (!looksLikePersonInputBlock) return null;

  return {
    httpStatus: 422,
    code: "INPUT_IMAGE_PERSON_POLICY",
    error:
      "The image model refused this request: an input image may show a real or recognizable person. That can include your product photo, extra reference images, or a brand logo with a face. Try a packshot with no people, remove reference images, or turn off “Apply branding” if your logo is photographic.",
  };
}
