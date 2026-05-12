import * as cheerio from "cheerio";
import {
  emptyTypographySlot,
  type BrandingKit,
} from "@/lib/branding/types";
import { isAllowedRasterLogoType } from "@/lib/branding/logo-media";
import { typographySlotForFamily } from "@/lib/branding/typography-slot-for-family";
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
   * Optional logo bytes from page metadata (icons, JSON-LD, then og:image only
   * as a weak fallback). Caller uploads to storage; the kit row has no binary.
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

function parseAppleTouchSize(href: string, sizes: string | undefined): number {
  if (!sizes) return 0;
  const m = /^(\d+)x\d+$/i.exec(sizes.trim());
  if (!m) return 0;
  return Number(m[1]) || 0;
}

/** Pull Organization / Brand `logo` URLs from JSON-LD blocks (often the real mark). */
function collectLogoUrlsFromJsonLd(value: unknown, out: Set<string>): void {
  if (value === null || value === undefined) return;
  if (typeof value === "string") {
    const t = value.trim();
    if (
      t &&
      (t.startsWith("http://") ||
        t.startsWith("https://") ||
        t.startsWith("//"))
    ) {
      out.add(t.startsWith("//") ? `https:${t}` : t);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectLogoUrlsFromJsonLd(item, out);
    return;
  }
  if (typeof value !== "object") return;
  const o = value as Record<string, unknown>;
  const types = o["@type"];
  const typeStr = Array.isArray(types)
    ? types.map(String).join(" ")
    : typeof types === "string"
      ? types
      : "";
  const isOrgLike =
    /\b(Organization|Corporation|Brand|LocalBusiness|OnlineStore|MedicalOrganization|EducationalOrganization)\b/i.test(
      typeStr,
    );
  if (isOrgLike && "logo" in o) {
    const logo = o["logo"];
    if (typeof logo === "string") {
      collectLogoUrlsFromJsonLd(logo, out);
    } else if (logo && typeof logo === "object") {
      const lo = logo as Record<string, unknown>;
      if (typeof lo.url === "string") collectLogoUrlsFromJsonLd(lo.url, out);
      if (typeof lo["@id"] === "string") collectLogoUrlsFromJsonLd(lo["@id"], out);
    }
  }
  for (const k of Object.keys(o)) {
    if (k === "logo" && !isOrgLike) continue;
    collectLogoUrlsFromJsonLd(o[k], out);
  }
}

/** First candidate URL from an HTML srcset attribute (approximate). */
function parseSrcsetFirstUrl(srcset: string): string | null {
  const first = srcset.split(",")[0]?.trim();
  if (!first) return null;
  const urlPart = first.split(/\s+/)[0]?.trim();
  return urlPart || null;
}

function resolveImageHref(pageUrl: URL, raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const t = raw.trim();
  if (t.startsWith("data:") || t.toLowerCase().startsWith("javascript:")) {
    return null;
  }
  try {
    const u = new URL(t, pageUrl.href);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.href;
  } catch {
    return null;
  }
}

/**
 * Heuristic DOM logo images: header/nav, #logo, itemprop, class hints.
 * Priorities sit between JSON-LD (220) and favicon (180).
 */
function collectDomLogoCandidates(
  $: cheerio.CheerioAPI,
  pageUrl: URL,
): { href: string; priority: number; source: string }[] {
  const out: { href: string; priority: number; source: string }[] = [];
  const seen = new Set<string>();

  function push(
    hrefRaw: string | null | undefined,
    srcsetRaw: string | null | undefined,
    priority: number,
    source: string,
  ) {
    const fromSrc = hrefRaw?.trim() ? hrefRaw : null;
    const fromSet =
      !fromSrc && srcsetRaw?.trim() ? parseSrcsetFirstUrl(srcsetRaw) : null;
    const raw = fromSrc ?? fromSet;
    const abs = resolveImageHref(pageUrl, raw);
    if (!abs || seen.has(abs)) return;
    seen.add(abs);
    out.push({ href: abs, priority, source });
  }

  $("#logo img[src], #logo img[srcset]").each((_, el) => {
    const $el = $(el);
    push($el.attr("src"), $el.attr("srcset"), 215, "dom:#logo");
  });

  $(
    '[itemprop="logo"] img[src], [itemprop="logo"] img[srcset], img[itemprop="logo"][src]',
  ).each((_, el) => {
    const $el = $(el);
    push($el.attr("src"), $el.attr("srcset"), 213, "dom:itemprop-logo");
  });

  $('header a[href="/"] img[src], header a[href="/"] img[srcset]').each(
    (_, el) => {
      const $el = $(el);
      push($el.attr("src"), $el.attr("srcset"), 211, "dom:header-home-img");
    },
  );

  $("nav img[src], nav img[srcset]").each((_, el) => {
    const $el = $(el);
    push($el.attr("src"), $el.attr("srcset"), 207, "dom:nav-img");
  });

  $(
    'header img[src], header img[srcset], [role="banner"] img[src], [role="banner"] img[srcset]',
  ).each((_, el) => {
    const $el = $(el);
    push($el.attr("src"), $el.attr("srcset"), 204, "dom:header-img");
  });

  $('.site-header img[src], .site-header img[srcset], [class*="logo" i] img[src], [class*="logo" i] img[srcset]').each(
    (_, el) => {
      const $el = $(el);
      push($el.attr("src"), $el.attr("srcset"), 202, "dom:class-logo");
    },
  );

  return out;
}

function extractJsonLdLogoHrefs($: cheerio.CheerioAPI): string[] {
  const urls = new Set<string>();
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text().trim();
    if (!raw) return;
    try {
      const parsed: unknown = JSON.parse(raw);
      collectLogoUrlsFromJsonLd(parsed, urls);
    } catch {
      /* ignore invalid JSON-LD */
    }
  });
  return [...urls];
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

  const logoCandidates: { href: string; priority: number; source: string }[] =
    [];

  // Largest apple-touch icons first — almost always a real app/site mark.
  $(
    'link[rel="apple-touch-icon"][href], link[rel="apple-touch-icon-precomposed"][href]',
  ).each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const sizes = $(el).attr("sizes");
    const px = parseAppleTouchSize(href, sizes);
    logoCandidates.push({ href, priority: 300 + px, source: "apple-touch" });
  });

  // Structured data logos beat generic favicons and beat og:image (often a hero).
  for (const href of extractJsonLdLogoHrefs($)) {
    logoCandidates.push({ href, priority: 220, source: "json-ld" });
  }

  // In-page images (header, #logo, nav) — many sites only expose the mark here.
  logoCandidates.push(...collectDomLogoCandidates($, pageUrl));

  $('link[rel="icon"][href], link[rel="shortcut icon"][href]').each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const type = ($(el).attr("type") ?? "").toLowerCase();
    const hrefLower = href.toLowerCase();
    const looksRaster =
      /\.(png|jpe?g|webp)(\?|$)/i.test(hrefLower) ||
      type === "image/png" ||
      type === "image/jpeg" ||
      type === "image/webp";
    const bonus = looksRaster ? 12 : 0;
    logoCandidates.push({ href, priority: 180 + bonus, source: "favicon" });
  });

  $(
    'link[rel="mask-icon"][href], link[rel="fluid-icon"][href], link[rel="apple-touch-startup-image"][href]',
  ).each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    logoCandidates.push({ href, priority: 175, source: "link:mask-or-fluid" });
  });

  const twImage =
    metaContent($, 'meta[name="twitter:image"]') ||
    metaContent($, 'meta[property="twitter:image"]');
  if (twImage) {
    logoCandidates.push({ href: twImage, priority: 38, source: "twitter:image" });
  }

  const ogImage = $('meta[property="og:image"]').attr("content");
  if (ogImage?.trim()) {
    logoCandidates.push({
      href: ogImage.trim(),
      priority: 40,
      source: "og:image",
    });
  }

  logoCandidates.sort((a, b) => b.priority - a.priority);

  let logoBytes: Buffer | null = null;
  let logoMediaType: string | null = null;
  let logoSource: string | null = null;
  let notedNonRasterSkip = false;

  for (const { href, source } of logoCandidates) {
    try {
      const found = await tryFetchLogo(pageUrl, href, warnings);
      if (!found) continue;
      if (!isAllowedRasterLogoType(found.mediaType)) {
        if (!notedNonRasterSkip) {
          notedNonRasterSkip = true;
          warnings.push(
            "Some logo candidates were not stored formats (e.g. SVG) — trying other image sources.",
          );
        }
        continue;
      }
      logoBytes = found.buffer;
      logoMediaType = found.mediaType;
      logoSource = source;
      break;
    } catch {
      /* try next */
    }
  }

  if (logoSource === "og:image" || logoSource === "twitter:image") {
    warnings.push(
      "Logo was taken from a social preview image, which is often not the real logo — upload the correct file in Branding if it looks wrong.",
    );
  }

  if (!logoBytes && logoCandidates.length > 0) {
    warnings.push(
      "Could not load a storable logo (PNG, JPEG, or WebP) from the page. You can upload one in Branding.",
    );
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
