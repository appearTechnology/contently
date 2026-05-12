import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/supabase/server";
import {
  defaultModelIdForCapability,
  getModelById,
  getModelsForCapability,
  modelSupportsFormat,
} from "@/lib/models/registry";
import {
  GenerateAdCreativeError,
  generateAdCreative,
} from "@/lib/ai/generate-ad-creative";
import { mapProviderGenerationError } from "@/lib/ai/map-provider-generation-error";
import { formatBrandingForPrompt } from "@/lib/branding/format-prompt";
import { loadBrandingKitForGenerate } from "@/lib/branding/server-store";

export const runtime = "nodejs";
/** Video generation (e.g. Seedance) can exceed photo latency; raise on Pro if needed. */
export const maxDuration = 300;

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_BRAND_CONTEXT_CHARS = 8000;
const MAX_REFERENCE_IMAGES = 5;
const ALLOWED_MEDIA = new Set(["image/jpeg", "image/png", "image/webp"]);

function extensionForMediaType(mediaType: string): string {
  if (mediaType === "image/jpeg") return "jpg";
  if (mediaType === "image/png") return "png";
  if (mediaType === "image/webp") return "webp";
  if (mediaType === "video/mp4") return "mp4";
  if (mediaType === "video/webm") return "webm";
  if (mediaType === "video/quicktime") return "mov";
  return "bin";
}

export async function POST(request: Request) {
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

  const promptRaw = form.get("prompt");
  const formatRaw = form.get("format");
  const modelIdRaw = form.get("modelId");
  const applyBrandingRaw = form.get("applyBranding");
  const file = form.get("image");

  const prompt = typeof promptRaw === "string" ? promptRaw.trim() : "";
  const applyBranding = applyBrandingRaw === "1";
  const format = formatRaw === "video" ? "video" : "photo";

  if (format === "video" && getModelsForCapability("video").length === 0) {
    return NextResponse.json(
      {
        error:
          "No video-capable models are registered. Add entries with the `video` capability in lib/models/registry.ts.",
        code: "NO_VIDEO_MODELS",
      },
      { status: 400 },
    );
  }

  const modelId =
    typeof modelIdRaw === "string" && modelIdRaw.length > 0
      ? modelIdRaw
      : defaultModelIdForCapability(format === "photo" ? "image" : "video") ?? "";

  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Product image is required" }, { status: 400 });
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: `Image must be at most ${MAX_IMAGE_BYTES / (1024 * 1024)} MB` },
      { status: 400 },
    );
  }

  const imageMediaType = file.type || "application/octet-stream";
  if (!ALLOWED_MEDIA.has(imageMediaType)) {
    return NextResponse.json(
      { error: "Image must be JPEG, PNG, or WebP" },
      { status: 400 },
    );
  }

  const model = getModelById(modelId);
  if (!model) {
    return NextResponse.json({ error: "Unknown model" }, { status: 400 });
  }

  if (!modelSupportsFormat(model, format)) {
    return NextResponse.json(
      { error: "Selected model does not support this output format" },
      { status: 400 },
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const imageBuffer = Buffer.from(arrayBuffer);

  let brandContext = "";
  let brandLogoBuffer: Buffer | undefined;
  let brandLogoMediaType: string | undefined;

  if (applyBranding) {
    const branding = await loadBrandingKitForGenerate(userId);
    const ctx = formatBrandingForPrompt(branding.view);
    if (ctx) {
      brandContext =
        ctx.length > MAX_BRAND_CONTEXT_CHARS
          ? ctx.slice(0, MAX_BRAND_CONTEXT_CHARS)
          : ctx;
    }
    if (
      branding.logoBuffer &&
      branding.logoMediaType &&
      ALLOWED_MEDIA.has(branding.logoMediaType)
    ) {
      brandLogoBuffer = branding.logoBuffer;
      brandLogoMediaType = branding.logoMediaType;
    }
  }

  const referenceRaw = form.getAll("referenceImages");
  const referenceBuffers: { buffer: Buffer; mediaType: string }[] = [];
  for (const entry of referenceRaw) {
    if (referenceBuffers.length >= MAX_REFERENCE_IMAGES) {
      return NextResponse.json(
        {
          error: `At most ${MAX_REFERENCE_IMAGES} extra reference images allowed`,
        },
        { status: 400 },
      );
    }
    if (!(entry instanceof File) || entry.size === 0) continue;
    if (entry.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        {
          error: `Each reference image must be at most ${MAX_IMAGE_BYTES / (1024 * 1024)} MB`,
        },
        { status: 400 },
      );
    }
    const refType = entry.type || "application/octet-stream";
    if (!ALLOWED_MEDIA.has(refType)) {
      return NextResponse.json(
        { error: "Reference images must be JPEG, PNG, or WebP" },
        { status: 400 },
      );
    }
    const refAb = await entry.arrayBuffer();
    referenceBuffers.push({ buffer: Buffer.from(refAb), mediaType: refType });
  }

  try {
    const out = await generateAdCreative({
      model,
      format,
      prompt,
      imageBuffer,
      imageMediaType,
      ...(referenceBuffers.length > 0 ? { referenceBuffers } : {}),
      ...(brandContext ? { brandContext } : {}),
      ...(brandLogoBuffer && brandLogoMediaType
        ? { brandLogoBuffer, brandLogoMediaType }
        : {}),
    });

    const ext = extensionForMediaType(out.mediaType);
    return NextResponse.json({
      kind: out.kind,
      mediaType: out.mediaType,
      base64: out.base64,
      downloadName: `ad-creative.${ext}`,
    });
  } catch (err) {
    if (err instanceof GenerateAdCreativeError && err.code === "NO_VIDEO_MODELS") {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 400 },
      );
    }
    const mapped = mapProviderGenerationError(err);
    if (mapped) {
      return NextResponse.json(
        { error: mapped.error, code: mapped.code },
        { status: mapped.httpStatus },
      );
    }
    const message = err instanceof Error ? err.message : "Generation failed";
    console.error("[api/generate]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
