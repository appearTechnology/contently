/**
 * Color normalization + palette extraction for brand import.
 *
 * Accepts the formats that show up in scraped CSS and in the vision model's
 * output: `#rgb` / `#rrggbb`, `rgb()/rgba()`, and `oklch()`. Everything is
 * normalized to lowercase `#rrggbb` so palettes can be deduped reliably.
 */

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function toByteHex(n: number): string {
  return Math.round(clamp01(n) * 255)
    .toString(16)
    .padStart(2, "0");
}

function hexFromHash(c: string): string | null {
  const v = c.toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  if (/^#[0-9a-f]{3}$/.test(v)) {
    return "#" + v.slice(1).split("").map((x) => x + x).join("");
  }
  return null;
}

function hexFromRgb(c: string): string | null {
  const m = c.match(/rgba?\(\s*(\d+)\s*[,\s]\s*(\d+)\s*[,\s]\s*(\d+)/i);
  if (!m) return null;
  const [r, g, b] = [+m[1], +m[2], +m[3]];
  return "#" + [r, g, b].map((n) => toByteHex(n / 255)).join("");
}

/** Parse a single `oklch()` channel; supports `none`, `%`, and angle units. */
function parseOklchChannel(
  raw: string,
  kind: "L" | "C" | "H",
): number {
  const s = raw.trim().toLowerCase();
  if (s === "none") return 0;
  const num = parseFloat(s);
  if (!Number.isFinite(num)) return 0;
  if (kind === "L") return s.endsWith("%") ? num / 100 : num;
  if (kind === "C") return s.endsWith("%") ? (num / 100) * 0.4 : num;
  // Hue, normalized to degrees.
  if (s.endsWith("turn")) return num * 360;
  if (s.endsWith("grad")) return num * 0.9;
  if (s.endsWith("rad")) return (num * 180) / Math.PI;
  return num;
}

/**
 * Convert `oklch(L C H[ / a])` to `#rrggbb`.
 * Uses Björn Ottosson's OKLab → linear sRGB matrices, then sRGB gamma.
 */
function hexFromOklch(c: string): string | null {
  const m = c.match(/oklch\(\s*([^)]+)\)/i);
  if (!m) return null;
  const parts = m[1].split("/")[0].trim().split(/[\s,]+/).filter(Boolean);
  if (parts.length < 3) return null;

  const L = parseOklchChannel(parts[0], "L");
  const C = parseOklchChannel(parts[1], "C");
  const Hdeg = parseOklchChannel(parts[2], "H");
  const h = (Hdeg * Math.PI) / 180;

  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const mm = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const lr = 4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s;

  const gamma = (x: number) =>
    x >= 0.0031308 ? 1.055 * Math.pow(x, 1 / 2.4) - 0.055 : 12.92 * x;

  return "#" + [gamma(lr), gamma(lg), gamma(lb)].map(toByteHex).join("");
}

/** Normalize any supported color string to lowercase `#rrggbb`, or null. */
export function colorToHex(c: string): string | null {
  const v = c?.trim();
  if (!v) return null;
  if (v.startsWith("#")) return hexFromHash(v);
  if (/^oklch\(/i.test(v)) return hexFromOklch(v);
  if (/^rgba?\(/i.test(v)) return hexFromRgb(v);
  return null;
}

export function pickPalette(rawColors: string[]): {
  primary: string[];
  secondary: string[];
} {
  const counts = new Map<string, number>();
  for (const raw of rawColors) {
    const hex = colorToHex(raw);
    if (!hex) continue;
    if (hex === "#ffffff" || hex === "#000000") continue;
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  const sorted = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([h]) => h);
  return { primary: sorted.slice(0, 3), secondary: sorted.slice(3, 8) };
}

/** Merge color lists in priority order, normalizing + deduping to hex. */
export function dedupHex(...lists: string[][]): string[] {
  const out: string[] = [];
  for (const list of lists) {
    for (const c of list) {
      const hex = colorToHex(c);
      if (hex && !out.includes(hex)) out.push(hex);
    }
  }
  return out;
}
