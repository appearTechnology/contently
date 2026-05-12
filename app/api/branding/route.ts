import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/supabase/server";
import {
  emptyTypographySlot,
  type BrandingKit,
  type TypographySlot,
  type TypographySlotKind,
} from "@/lib/branding/types";
import { normalizeVoiceToneTags } from "@/lib/branding/voice-tone-tags";
import { normalizeExtraPaletteColors } from "@/lib/branding/extra-palette-colors";
import {
  BrandingStoreError,
  getBrandingKitView,
  upsertBrandingKit,
  type BrandingAssetUpload,
} from "@/lib/branding/server-store";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_LOGO_BYTES = 8 * 1024 * 1024;
const MAX_FONT_BYTES = 2 * 1024 * 1024;

function clean(s: unknown): string {
  return typeof s === "string" ? s : "";
}

function parseTypography(raw: unknown): TypographySlot {
  if (typeof raw !== "object" || raw === null) return emptyTypographySlot();
  const r = raw as Record<string, unknown>;
  const kindRaw = r.kind;
  const kind: TypographySlotKind =
    kindRaw === "google" || kindRaw === "custom" ? kindRaw : "manual";
  return {
    kind,
    manual: clean(r.manual),
    googleFamily: clean(r.googleFamily),
    customFamily: clean(r.customFamily),
  };
}

function parseKitJson(raw: unknown): BrandingKit | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  return {
    version: 2,
    brandName: clean(r.brandName).slice(0, 200),
    tagline: clean(r.tagline).slice(0, 500),
    primaryColor: clean(r.primaryColor).slice(0, 32),
    secondaryColor: clean(r.secondaryColor).slice(0, 32),
    accentColor: clean(r.accentColor).slice(0, 32),
    extraPaletteColors: normalizeExtraPaletteColors(r.extraPaletteColors),
    headingTypography: parseTypography(r.headingTypography),
    bodyTypography: parseTypography(r.bodyTypography),
    voiceTone: clean(r.voiceTone).slice(0, 4000),
    voiceToneTags: normalizeVoiceToneTags(r.voiceToneTags),
    extraNotes: clean(r.extraNotes).slice(0, 8000),
  };
}

async function fileToAsset(
  field: FormDataEntryValue | null,
  filenameStem: BrandingAssetUpload["filenameStem"],
  maxBytes: number,
): Promise<BrandingAssetUpload | null> {
  if (!(field instanceof File) || field.size === 0) return null;
  if (field.size > maxBytes) {
    throw new BrandingStoreError(
      `${filenameStem} exceeds ${maxBytes / (1024 * 1024)} MB`,
      "ASSET_TOO_LARGE",
      400,
    );
  }
  const arrayBuffer = await field.arrayBuffer();
  return {
    bytes: Buffer.from(arrayBuffer),
    mediaType: field.type || "application/octet-stream",
    filenameStem,
  };
}

export async function GET() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const view = await getBrandingKitView(userId);
  return NextResponse.json({ view });
}

export async function PUT(request: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Expected multipart/form-data" },
      { status: 400 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const kitRaw = form.get("kit");
  if (typeof kitRaw !== "string") {
    return NextResponse.json(
      { error: "Missing `kit` JSON field" },
      { status: 400 },
    );
  }

  let kitJson: unknown;
  try {
    kitJson = JSON.parse(kitRaw);
  } catch {
    return NextResponse.json(
      { error: "`kit` must be valid JSON" },
      { status: 400 },
    );
  }
  const kit = parseKitJson(kitJson);
  if (!kit) {
    return NextResponse.json(
      { error: "Malformed kit payload" },
      { status: 400 },
    );
  }

  try {
    const logo = await fileToAsset(form.get("logo"), "logo", MAX_LOGO_BYTES);
    const secondaryLogo = await fileToAsset(
      form.get("secondaryLogo"),
      "secondary-logo",
      MAX_LOGO_BYTES,
    );
    const icon = await fileToAsset(form.get("icon"), "icon", MAX_LOGO_BYTES);
    const headingFont = await fileToAsset(
      form.get("headingFont"),
      "heading-font",
      MAX_FONT_BYTES,
    );
    const bodyFont = await fileToAsset(
      form.get("bodyFont"),
      "body-font",
      MAX_FONT_BYTES,
    );

    const view = await upsertBrandingKit({
      userId,
      kit,
      logo,
      secondaryLogo,
      icon,
      headingFont,
      bodyFont,
      removeLogo: form.get("removeLogo") === "1",
      removeSecondaryLogo: form.get("removeSecondaryLogo") === "1",
      removeIcon: form.get("removeIcon") === "1",
      removeHeadingFont: form.get("removeHeadingFont") === "1",
      removeBodyFont: form.get("removeBodyFont") === "1",
    });

    return NextResponse.json({ view });
  } catch (err) {
    if (err instanceof BrandingStoreError) {
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
    console.error("[api/branding PUT]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
