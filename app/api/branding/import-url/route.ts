import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/supabase/server";
import { enrichBrandingWithLLM } from "@/lib/branding/import-url/enrich-with-llm";
import { extractDeterministic } from "@/lib/branding/import-url/extract";
import { mergeImportedBranding } from "@/lib/branding/import-url/merge-kit";
import {
  normalizeImportUrl,
  SafeFetchError,
  safeFetchHtml,
} from "@/lib/branding/import-url/safe-fetch";
import {
  BrandingStoreError,
  upsertBrandingKit,
} from "@/lib/branding/server-store";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Maps fetch guard failures to HTTP statuses (502 is reserved for true proxy/upstream failures). */
function statusForSafeFetchError(code: SafeFetchError["code"]): number {
  switch (code) {
    case "INVALID_URL":
    case "FORBIDDEN_HOST":
      return 400;
    case "TOO_LARGE":
      return 413;
    case "BAD_STATUS":
    case "TOO_MANY_REDIRECTS":
      return 422;
    case "FETCH_TIMEOUT":
      return 504;
    case "FETCH_FAILED":
    default:
      return 503;
  }
}

export async function POST(request: Request) {
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

  const urlRaw =
    typeof body === "object" &&
    body !== null &&
    "url" in body &&
    typeof (body as { url: unknown }).url === "string"
      ? (body as { url: string }).url
      : undefined;

  if (!urlRaw?.trim()) {
    return NextResponse.json({ error: "Missing or invalid `url`." }, { status: 400 });
  }

  let startUrl: URL;
  try {
    startUrl = normalizeImportUrl(urlRaw);
  } catch (e) {
    if (e instanceof SafeFetchError) {
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: statusForSafeFetchError(e.code) },
      );
    }
    throw e;
  }

  let fetched;
  try {
    fetched = await safeFetchHtml(startUrl);
  } catch (e) {
    if (e instanceof SafeFetchError) {
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: statusForSafeFetchError(e.code) },
      );
    }
    throw e;
  }

  const html = fetched.buffer.toString("utf8");
  const finalPageUrl = new URL(fetched.finalUrl);

  const deterministic = await extractDeterministic(html, finalPageUrl);
  const warnings = [...deterministic.warnings];

  const llmResult = await enrichBrandingWithLLM({ deterministic });
  const enrichment = llmResult.ok ? llmResult.data : null;
  if (!llmResult.ok) {
    warnings.push(`AI enrichment skipped: ${llmResult.error}`);
  }

  const kit = mergeImportedBranding(deterministic, enrichment);

  try {
    const view = await upsertBrandingKit({
      userId,
      kit,
      logo:
        deterministic.logoBytes && deterministic.logoMediaType
          ? {
              bytes: deterministic.logoBytes,
              mediaType: deterministic.logoMediaType,
              filenameStem: "logo",
            }
          : null,
    });
    return NextResponse.json({ view, warnings });
  } catch (err) {
    if (err instanceof BrandingStoreError) {
      // Asset rejection (e.g. SVG/GIF favicon) shouldn't fail the whole import
      // — try again without the logo and surface a warning.
      if (err.code === "INVALID_LOGO_TYPE" || err.code === "LOGO_TOO_LARGE") {
        warnings.push(`Logo skipped: ${err.message}`);
        try {
          const view = await upsertBrandingKit({ userId, kit });
          return NextResponse.json({ view, warnings });
        } catch (retryErr) {
          const msg =
            retryErr instanceof Error ? retryErr.message : "Save failed";
          return NextResponse.json({ error: msg }, { status: 500 });
        }
      }
      return NextResponse.json(
        {
          error: err.message,
          code: err.code,
          ...(err.hint ? { hint: err.hint } : {}),
        },
        { status: err.status },
      );
    }
    const message = err instanceof Error ? err.message : "Save failed";
    console.error("[api/branding/import-url]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
