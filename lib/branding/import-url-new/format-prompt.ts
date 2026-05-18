import type { ParsedBrandDNA } from "./parse";

function clean(s: string): string {
  return s.trim();
}

function joinList(items: string[]): string {
  return items.map(clean).filter(Boolean).join(", ");
}

/**
 * Human-readable brand block injected into ad generation when branding is
 * enabled. Mirrors {@link formatBrandingForPrompt} but reads the new
 * `brand_dna` shape ({@link ParsedBrandDNA}).
 */
export function formatBrandDnaForPrompt(dna: ParsedBrandDNA): string {
  const lines: string[] = [];

  const name = clean(dna.brandName);
  const industry = clean(dna.industry);
  const tagline = clean(dna.tagline);
  const valueProp = clean(dna.valueProposition);
  const audience = clean(dna.targetAudience);
  const imagery = clean(dna.imageryStyle);
  const layout = clean(dna.layoutStyle);

  if (name) lines.push(`Brand name: ${name}`);
  if (industry) lines.push(`Industry: ${industry}`);
  if (tagline) lines.push(`Tagline / lockup text: ${tagline}`);
  if (valueProp) lines.push(`Value proposition: ${valueProp}`);
  if (audience) lines.push(`Target audience: ${audience}`);

  const colors: string[] = [];
  const primary = joinList(dna.primaryColors);
  const secondary = joinList(dna.secondaryColors);
  if (primary) colors.push(`primary ${primary}`);
  if (secondary) colors.push(`secondary ${secondary}`);
  if (colors.length) lines.push(`Palette: ${colors.join("; ")}`);

  const fonts = joinList(dna.fonts);
  if (fonts) lines.push(`Typography: ${fonts}`);

  const tone = joinList(dna.toneOfVoice);
  if (tone) lines.push(`Voice & tone: ${tone}`);

  const personality = joinList(dna.brandPersonality);
  if (personality) lines.push(`Brand personality: ${personality}`);

  const messages = dna.keyMessages.map(clean).filter(Boolean);
  if (messages.length) {
    lines.push(`Key messages:\n${messages.map((m) => `- ${m}`).join("\n")}`);
  }

  if (imagery) lines.push(`Imagery style: ${imagery}`);
  if (layout) lines.push(`Layout style: ${layout}`);

  return lines.join("\n").trim();
}

/** True when the DNA carries anything worth injecting into a generation. */
export function hasBrandDnaContent(dna: ParsedBrandDNA): boolean {
  return formatBrandDnaForPrompt(dna).length > 0 || Boolean(dna.logoUrl);
}
