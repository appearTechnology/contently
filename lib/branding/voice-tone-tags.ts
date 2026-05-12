export const MAX_VOICE_TONE_TAGS = 12;
export const MAX_VOICE_TONE_TAG_LENGTH = 40;

/** Dedupes case-insensitively, preserves first-seen casing, caps count and length. */
export function normalizeVoiceToneTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const t = item.trim().slice(0, MAX_VOICE_TONE_TAG_LENGTH);
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= MAX_VOICE_TONE_TAGS) break;
  }
  return out;
}
