import "server-only";
import { createHash, randomUUID } from "node:crypto";
import {
    brandingAssetsBucket,
    tryCreateSupabaseAdminClient,
} from "@/lib/supabase/admin";
import { ScrapedWebsite } from "../branding/types";
import { dedupHex, pickPalette } from "../branding/colors";
import { generateText, Output } from "ai";
import z from "zod"

export type UploadedScreenshot = {
    publicUrl: string;
};


function decodeBase64Png(raw: string): Buffer | null {
    const trimmed = raw?.trim();
    if (!trimmed) return null;
    const dataUrl = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(trimmed);
    const payload = dataUrl ? dataUrl[1]! : trimmed;
    try {
        const bytes = Buffer.from(payload, "base64");
        return bytes.byteLength > 0 ? bytes : null;
    } catch {
        return null;
    }
}


function screenshotPathFor(url: string): string {
    const slug = createHash("sha1").update(url).digest("hex").slice(0, 16);
    return `screenshots/${slug}-${randomUUID()}.png`;
}


export async function uploadScreenshot(
    data: ScrapedWebsite,
): Promise<string | null> {
    const bytes = decodeBase64Png(data.screenshot);
    if (!bytes) return null;

    const supabase = tryCreateSupabaseAdminClient();
    if (!supabase) {
        if (process.env.NODE_ENV === "development") {
            console.warn(
                "[analyze-brand] Supabase admin key missing — skipping screenshot upload.",
            );
        }
        throw new Error("[analyze-brand] Supabase admin key missing — skipping screenshot upload.")
    }

    const bucket = brandingAssetsBucket();
    const path = screenshotPathFor(data.url);

    const { error: uploadErr } = await supabase.storage
        .from(bucket)
        .upload(path, bytes, {
            contentType: "image/png",
            upsert: true,
            cacheControl: "3600",
        });
    if (uploadErr) {
        throw new Error(`Could not upload screenshot: ${uploadErr.message}`);
    }

    const {
        data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(path);

    return publicUrl;
}

const TEXT_PROMPT = `You are a brand analyst. Given the website content below, extract the brand DNA as STRICT JSON only (no commentary, no markdown). Use this exact shape:
{
  "brand_name": "string",
  "industry": "string",
  "tagline": "string",
  "value_proposition": "string",
  "tone_of_voice": ["3-5 trait words"],
  "brand_personality": ["3-5 trait words"],
  "target_audience": "one sentence",
  "key_messages": ["3-5 short messages"],
  "imagery_style": "professional | casual | illustrated | cinematic | minimalist | editorial",
  "layout_style": "modern | classic | minimalist | bold | editorial"
}

WEBSITE TITLE: {{title}}
META DESCRIPTION: {{description}}
BODY TEXT (truncated):
{{body}}`;

const VISION_PROMPT = `Analyze this website screenshot and return STRICT JSON only (no markdown, no commentary):
{
  "primary_colors": ["#hex","#hex","#hex"],
  "secondary_colors": ["#hex","#hex"],
  "typography": "serif | sans-serif | modern | classic | display",
  "logo_style": "wordmark | icon | combination",
  "imagery_style": "professional | casual | illustrated | cinematic | minimalist | editorial",
  "layout_style": "modern | classic | minimalist | bold | editorial",
  "brand_vibe": ["3-5 vibe words"]
}`;

export async function analyzeBrand(data: ScrapedWebsite) {
    // store the screenshot in the supabase storage
    const screenshot = await uploadScreenshot(data);

    // get and replace the text prompt
    const textPrompt = TEXT_PROMPT.replace("{{title}}", data.title)
        .replace("{{description}}", data.description)
        .replace("{{body}}", data.bodyText);

    // get llm insights
    // 1. Details from text data
    const textObject = await generateText({
        model: "anthropic/claude-sonnet-4.6",
        output: Output.object({
            schema: z.object({
                "brand_name": z.string(),
                "industry": z.string(),
                "tagline": z.string(),
                "value_proposition": z.string(),
                "tone_of_voice": z.string().array().describe("3-5 trait words"),
                "brand_personality": z.string().array().describe("3-5 trait words"),
                "target_audience": z.string(),
                "key_messages": z.string().array().describe("3-5 short messages"),
                "imagery_style": z.enum(["professional", "casual", "illustrated", "cinematic", "minimalist", "editorial"]),
                "layout_style": z.enum(["modern", "classic", "minimalist", "bold", "editorial"])
            }),
        }),
        prompt: textPrompt
    })

    const visionObject = await generateText({
        model: "openai/gpt-5.5",
        allowSystemInMessages: true,
        output: Output.object({
            schema: z.object({
                primary_colors: z.string().array().describe("array of hex or oklach colors"),
                secondary_colors: z.string().array().describe("array of hex or oklach colors"),
                typography: z.enum(["serif", "sans-serif", "modern", "classic", "display"]),
                logo_style: z.enum(["wordmark", "icon", "combination"]),
                imagery_style: z.enum(["professional", "casual", "illustrated", "cinematic", "minimalist", "editorial"]),
                layout_style: z.enum(["modern", "classic", "minimalist", "bold", "editorial"]),
                brand_vibe: z.string().array().describe("3-5 vibe words"),
            })
        }),
        messages: [
            { role: "system", content: VISION_PROMPT },
            { role: "user", content: [{ type: "image", image: new URL(screenshot ?? data.screenshot) }] }
        ]
    })

    const text = textObject.output
    const vision = visionObject.output

    // Merge the vision model's colors (which may be hex or oklch) with the
    // palette derived from the site's scraped CSS, normalizing everything to
    // hex. Vision colors take priority; CSS palette fills the rest.
    const cssPalette = pickPalette(data.rawColors);
    const primaryColors = dedupHex(
        vision.primary_colors,
        cssPalette.primary,
    ).slice(0, 4);
    const secondaryColors = dedupHex(
        vision.secondary_colors,
        cssPalette.secondary,
    ).slice(0, 4);

    // logoUrl
    return {
        brandName: text.brand_name,
        industry: text.industry,
        tagline: text.tagline,
        valueProposition: text.value_proposition,
        toneOfVoice: text.tone_of_voice,
        targetAudience: text.target_audience,
        keyMessages: text.key_messages,
        brandPersonality: [...text.brand_personality, ...vision.brand_vibe],
        primaryColors,
        secondaryColors,
        fonts: data.fonts.slice(0, 3),
        logoUrl: data.logoCandidates[0] ?? data.favicon ?? data.ogImage,
        screenshotUrl: screenshot,
        imageryStyle: vision.imagery_style || text.imagery_style,
        layoutStyle: vision.layout_style || text.layout_style,
    };
}
