import { analyzeBrand } from "@/lib/ai/analyze-brand";
import { ScrapedWebsite } from "@/lib/branding/types";
import { db } from "@/lib/db";
import { brandDna } from "@/lib/db/schema";
import { getAuthenticatedUserId } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
    url: z
        .string()
        .trim()
        .min(1, "URL is required.")
        .transform((value) => (/^https?:\/\//i.test(value) ? value : `https://${value}`))
        .pipe(z.url("Invalid URL.")),
});

export async function POST(request: NextRequest) {
    try {
        const userId = await getAuthenticatedUserId();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
        }

        const parsed = bodySchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0]?.message ?? "Invalid request body." },
                { status: 400 }
            );
        }

        const { url } = parsed.data;

        const scraped = await scrapeFromWorker(url);

        const dna = await analyzeBrand(scraped);

        const row = {
            userId,
            url,
            brandName: dna.brandName,
            industry: dna.industry,
            tagline: dna.tagline,
            valueProposition: dna.valueProposition,
            toneOfVoice: JSON.stringify(dna.toneOfVoice),
            brandPersonality: JSON.stringify(dna.brandPersonality),
            targetAudience: dna.targetAudience,
            keyMessages: JSON.stringify(dna.keyMessages),
            primaryColors: JSON.stringify(dna.primaryColors),
            secondaryColors: JSON.stringify(dna.secondaryColors),
            fonts: JSON.stringify(dna.fonts),
            logoUrl: dna.logoUrl,
            screenshotUrl: dna.screenshotUrl,
            imageryStyle: dna.imageryStyle,
            layoutStyle: dna.layoutStyle,
            rawJson: JSON.stringify(dna),
        };

        const [saved] = await db
            .insert(brandDna)
            .values(row)
            .onConflictDoUpdate({
                target: [brandDna.userId, brandDna.url],
                set: row,
            })
            .returning();

        return NextResponse.json(saved);
    } catch (e) {
        console.log(e)
        return NextResponse.json(
            { error: e instanceof Error ? e.message : "Internal server error." },
            { status: 500 }
        );
    }
}


async function scrapeFromWorker(url: string): Promise<ScrapedWebsite> {
    if (!process.env.WORKER_URL) {
        throw new Error("[IMPORT_URL]: Worker not set")
    }

    if (!process.env.WORKER_SECRET_KEY) {
        throw new Error("[IMPORT_URL]: Worker secret key not set")
    }

    const response = await fetch(process.env.WORKER_URL + "/scrape", {
        method: "POST",
        body: JSON.stringify({
            url
        }),
        headers: {
            "Authorization": `Bearer ${process.env.WORKER_SECRET_KEY}`
        }
    })

    const data = await response.json() as ScrapedWebsite

    return data
}