const MAX_EXTRA_PALETTE_COLORS = 8;

/** Parse `#RGB`, `#RRGGBB`, or forms without `#`. Returns canonical `#rrggbb` or null. */
export function parseHexString(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(t);
  if (!m?.[1]) return null;
  let h = m[1];
  if (h.length === 3) {
    h = `${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
  }
  return `#${h.toLowerCase()}`;
}

/** Sanitize wire / DB JSON into a bounded list of hex strings. */
export function normalizeExtraPaletteColors(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (out.length >= MAX_EXTRA_PALETTE_COLORS) break;
    if (typeof item !== "string") continue;
    const hex = parseHexString(item);
    if (hex) out.push(hex);
  }
  return out;
}

export { MAX_EXTRA_PALETTE_COLORS };
