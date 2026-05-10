import * as cheerio from "cheerio";
import { GOOGLE_FONT_FAMILIES } from "@/lib/branding/google-fonts";
import {
  emptyTypographySlot,
  type BrandingKit,
  type TypographySlot,
} from "@/lib/branding/types";
import { safeFetchImage, safeFetchStylesheet } from "./safe-fetch";

const MAX_STYLESHEETS = 5;
const MAX_VISIBLE_TEXT_CHARS = 12_000;
const MAX_EXTERNAL_CSS_CHARS = 400_000;

const HEX_RE = /#([0-9a-fA-F]{3})\b|#([0-9a-fA-F]{6})\b/g;
const RGB_RE =
  /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*[\d.]+\s*)?\)/gi;

export type DeterministicExtraction = Pick<
  BrandingKit,
  | "brandName"
  | "tagline"
  | "primaryColor"
  | "secondaryColor"
  | "accentColor"
  | "headingTypography"
  | "bodyTypography"
> & {
  /**
   * Optional logo bytes pulled from the page's icon / og:image. Caller is
   * responsible for uploading these to Supabase Storage; the kit row itself
   * does not carry binary data.
   */
  logoBytes: Buffer | null;
  logoMediaType: string | null;
  visibleTextForLLM: string;
  deterministicSummary: string;
  warnings: string[];
};

function expandHex3(h: string): string {
  if (h.length !== 3) return h.toLowerCase();
  return (h[0] + h[0] + h[1] + h[1] + h[2] + h[2]).toLowerCase();
}

function normalizeHexToken(raw: string): string | null {
  const t = raw.trim();
  let hex = t.startsWith("#") ? t.slice(1) : t;
  if (/^[0-9a-fA-F]{3}$/.test(hex)) hex = expandHex3(hex);
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  return `#${hex.toLowerCase()}`;
}

function rgbToHex(r: number, g: number, b: number): string | null {
  if (r > 255 || g > 255 || b > 255) return null;
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function luminance(hex: string): number {
  const h = hex.startsWith("#") ? hex.slice(1) : hex;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function isNearNeutral(hex: string): boolean {
  const lum = luminance(hex);
  return lum > 0.94 || lum < 0.06;
}

function colorDistance(a: string, b: string): number {
  const pa = a.startsWith("#") ? a.slice(1) : a;
  const pb = b.startsWith("#") ? b.slice(1) : b;
  const ar = parseInt(pa.slice(0, 2), 16);
  const ag = parseInt(pa.slice(2, 4), 16);
  const ab = parseInt(pa.slice(4, 6), 16);
  const br = parseInt(pb.slice(0, 2), 16);
  const bg = parseInt(pb.slice(2, 4), 16);
  const bb = parseInt(pb.slice(4, 6), 16);
  return Math.max(Math.abs(ar - br), Math.abs(ag - bg), Math.abs(ab - bb));
}

function collectColorsFromText(text: string, counts: Map<string, number>): void {
  let m: RegExpExecArray | null;
  HEX_RE.lastIndex = 0;
  while ((m = HEX_RE.exec(text)) !== null) {
    const raw = m[1] ?? m[2];
    const hex = normalizeHexToken(raw.startsWith("#") ? raw : `#${raw}`);
    if (!hex || isNearNeutral(hex)) continue;
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  RGB_RE.lastIndex = 0;
  while ((m = RGB_RE.exec(text)) !== null) {
    const hex = rgbToHex(Number(m[1]), Number(m[2]), Number(m[3]));
    if (!hex || isNearNeutral(hex)) continue;
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
}

function pickTopDistinctColors(
  counts: Map<string, number>,
  n: number,
): string[] {
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const picked: string[] = [];
  const minDist = 40;
  for (const [hex] of sorted) {
    if (picked.length >= n) break;
    if (picked.every((p) => colorDistance(p, hex) >= minDist)) {
      picked.push(hex);
    }
  }
  while (picked.length < n) {
    picked.push("");
  }
  return picked.slice(0, n);
}

function stripTitleNoise(title: string): string {
  const t = title.replace(/\s+/g, " ").trim();
  if (!t) return "";
  const parts = t.split(/\s*[|\u2013\u2014\-]\s*/);
  return parts[0]?.trim() ?? t;
}

function metaContent($: cheerio.CheerioAPI, selector: string): string {
  const v = $(selector).attr("content");
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
}

function decodeGoogleFamilyParam(raw: string): string {
  const decoded = decodeURIComponent(raw.replace(/\+/g, " ")).trim();
  const base = decoded.split(":")[0]?.trim() ?? decoded;
  return base;
}

function familiesFromGoogleFontsHref(href: string): string[] {
  try {
    const u = new URL(href);
    if (!u.hostname.includes("fonts.googleapis.com")) return [];
    const names = u.searchParams.getAll("family");
    if (names.length === 0) return [];
    return [...new Set(names.map(decodeGoogleFamilyParam).filter(Boolean))];
  } catch {
    return [];
  }
}

function typographySlotForFamily(family: string): TypographySlot {
  const name = family.trim();
  if (!name) return emptyTypographySlot();
  const match = GOOGLE_FONT_FAMILIES.find(
    (f) => f.toLowerCase() === name.toLowerCase(),
  );
  if (match) {
    return {
      kind: "google",
      manual: "",
      googleFamily: match,
      customFamily: "",
    };
  }
  return {
    kind: "manual",
    manual: name,
    googleFamily: "",
    customFamily: "",
  };
}

function parseAppleTouchSize(href: string, sizes: string | undefined): number {
  if (!sizes) return 0;
  const m = /^(\d+)x\d+$/i.exec(sizes.trim());
  if (!m) return 0;
  return Number(m[1]) || 0;
}

async function tryFetchLogo(
  pageUrl: URL,
  href: string,
  warnings: string[],
): Promise<{ buffer: Buffer; mediaType: string } | null> {
  const res = await safeFetchImage(pageUrl, href);
  if (!res) return null;
  const ct = res.contentType?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!ct.startsWith("image/")) {
    warnings.push("Logo candidate was skipped (not an image response).");
    return null;
  }
  return { buffer: res.buffer, mediaType: ct };
}

export async function extractDeterministic(
  html: string,
  pageUrl: URL,
): Promise<DeterministicExtraction> {
  const warnings: string[] = [];
  const $ = cheerio.load(html);

  const brandName =
    metaContent($, 'meta[property="og:site_name"]') ||
    metaContent($, 'meta[name="application-name"]') ||
    stripTitleNoise($("title").first().text());

  const tagline =
    metaContent($, 'meta[property="og:description"]') ||
    metaContent($, 'meta[name="description"]') ||
    $("h1")
      .first()
      .text()
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 240);

  const themeColor = metaContent($, 'meta[name="theme-color"]');
  const colorCounts = new Map<string, number>();

  if (themeColor) {
    const th = themeColor.startsWith("#")
      ? normalizeHexToken(themeColor)
      : normalizeHexToken(`#${themeColor}`);
    if (th && !isNearNeutral(th)) {
      colorCounts.set(th, 1000);
    }
  }

  collectColorsFromText($.html() ?? "", colorCounts);

  const stylesheetHrefs: string[] = [];
  $('link[rel="stylesheet"][href]').each((_, el) => {
    const href = $(el).attr("href");
    if (href) stylesheetHrefs.push(href);
  });

  let cssAggregated = "";
  for (let i = 0; i < Math.min(stylesheetHrefs.length, MAX_STYLESHEETS); i++) {
    if (cssAggregated.length >= MAX_EXTERNAL_CSS_CHARS) break;
    const fetched = await safeFetchStylesheet(pageUrl, stylesheetHrefs[i]!);
    if (!fetched) continue;
    const text = fetched.buffer.toString("utf8");
    cssAggregated += text + "\n";
    collectColorsFromText(text, colorCounts);
  }

  const [c1, c2, c3] = pickTopDistinctColors(colorCounts, 3);

  const googleFamilies: string[] = [];
  $('link[href*="fonts.googleapis.com"]').each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    googleFamilies.push(...familiesFromGoogleFontsHref(href));
  });
  const uniqueFonts = [...new Set(googleFamilies)];

  const headingTypography = uniqueFonts[0]
    ? typographySlotForFamily(uniqueFonts[0]!)
    : emptyTypographySlot();
  const bodyTypography = uniqueFonts[1]
    ? typographySlotForFamily(uniqueFonts[1]!)
    : uniqueFonts[0]
      ? typographySlotForFamily(uniqueFonts[0]!)
      : emptyTypographySlot();

  const logoCandidates: { href: string; priority: number }[] = [];

  $('link[rel="apple-touch-icon"][href]').each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const sizes = $(el).attr("sizes");
    const px = parseAppleTouchSize(href, sizes);
    logoCandidates.push({ href, priority: 100 + px });
  });

  const ogImage = $('meta[property="og:image"]').attr("content");
  if (ogImage?.trim()) {
    logoCandidates.push({ href: ogImage.trim(), priority: 50 });
  }

  $('link[rel="icon"][href], link[rel="shortcut icon"][href]').each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    logoCandidates.push({ href, priority: 10 });
  });

  logoCandidates.sort((a, b) => b.priority - a.priority);

  let logoBytes: Buffer | null = null;
  let logoMediaType: string | null = null;
  for (const { href } of logoCandidates) {
    try {
      const found = await tryFetchLogo(pageUrl, href, warnings);
      if (found) {
        logoBytes = found.buffer;
        logoMediaType = found.mediaType;
        break;
      }
    } catch {
      /* try next */
    }
  }

  if (!logoBytes && logoCandidates.length > 0) {
    warnings.push("Could not load a logo image from the page icons or og:image.");
  }

  $("script, style, noscript").remove();
  const visibleText = $("body").text().replace(/\s+/g, " ").trim();
  const visibleTextForLLM = visibleText.slice(0, MAX_VISIBLE_TEXT_CHARS);

  const ogTitle = metaContent($, 'meta[property="og:title"]');
  const deterministicSummary = [
    brandName && `Brand name (guess): ${brandName}`,
    ogTitle && `og:title: ${ogTitle}`,
    tagline && `Description / tagline hint: ${tagline.slice(0, 500)}`,
    uniqueFonts.length > 0 && `Google Fonts detected: ${uniqueFonts.join(", ")}`,
    [c1, c2, c3].filter(Boolean).length > 0 &&
      `Colors sampled: ${[c1, c2, c3].filter(Boolean).join(", ")}`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    brandName: brandName.slice(0, 200),
    tagline: tagline.slice(0, 500),
    primaryColor: c1,
    secondaryColor: c2,
    accentColor: c3,
    headingTypography,
    bodyTypography,
    logoBytes,
    logoMediaType,
    visibleTextForLLM,
    deterministicSummary,
    warnings,
  };
}
