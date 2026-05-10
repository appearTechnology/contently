import "server-only";
import {
  brandingAssetsBucket,
  createSupabaseAdminClient,
} from "@/lib/supabase/admin";
import {
  DEFAULT_BRANDING_KIT,
  DEFAULT_BRANDING_KIT_VIEW,
  emptyTypographySlot,
  type BrandingKit,
  type BrandingKitView,
  type TypographySlot,
  type TypographySlotKind,
} from "@/lib/branding/types";
import {
  fontExtensionFromMediaType,
  imageExtensionFromMediaType,
} from "@/lib/branding/data-url";

const SIGNED_URL_TTL_SECONDS = 60 * 60;
const ALLOWED_LOGO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_FONT_TYPES = new Set([
  "font/woff2",
  "font/woff",
  "font/ttf",
  "font/otf",
  "application/font-woff2",
  "application/font-woff",
  "application/x-font-ttf",
  "application/x-font-otf",
]);

const MAX_LOGO_BYTES = 8 * 1024 * 1024;
const MAX_FONT_BYTES = 2 * 1024 * 1024;

type BrandingRow = {
  user_id: string;
  version: number | null;
  brand_name: string | null;
  tagline: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  voice_tone: string | null;
  extra_notes: string | null;
  heading_typography: unknown;
  body_typography: unknown;
  logo_path: string | null;
  logo_media_type: string | null;
  heading_font_path: string | null;
  heading_font_media_type: string | null;
  body_font_path: string | null;
  body_font_media_type: string | null;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function parseTypography(raw: unknown): TypographySlot {
  if (!isRecord(raw)) return emptyTypographySlot();
  const kindRaw = raw.kind;
  const kind: TypographySlotKind =
    kindRaw === "google" || kindRaw === "custom" ? kindRaw : "manual";
  const manual = typeof raw.manual === "string" ? raw.manual : "";
  const googleFamily =
    typeof raw.googleFamily === "string" ? raw.googleFamily : "";
  const customFamily =
    typeof raw.customFamily === "string" ? raw.customFamily : "";
  return { kind, manual, googleFamily, customFamily };
}

function rowToKit(row: BrandingRow): BrandingKit {
  return {
    version: 2,
    brandName: row.brand_name ?? "",
    tagline: row.tagline ?? "",
    primaryColor: row.primary_color ?? "",
    secondaryColor: row.secondary_color ?? "",
    accentColor: row.accent_color ?? "",
    headingTypography: parseTypography(row.heading_typography),
    bodyTypography: parseTypography(row.body_typography),
    voiceTone: row.voice_tone ?? "",
    extraNotes: row.extra_notes ?? "",
  };
}

async function signPath(
  path: string | null,
  bucket: string,
): Promise<string | null> {
  if (!path) return null;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/**
 * Returns the kit view for the given Clerk user. Resolves to the default
 * (empty) view if the row does not yet exist — caller can insert on first save.
 */
export async function getBrandingKitView(
  userId: string,
): Promise<BrandingKitView> {
  if (!userId) return DEFAULT_BRANDING_KIT_VIEW;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("branding_kits")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle<BrandingRow>();

  if (error || !data) return DEFAULT_BRANDING_KIT_VIEW;

  const bucket = brandingAssetsBucket();
  const [logoUrl, headingFontUrl, bodyFontUrl] = await Promise.all([
    signPath(data.logo_path, bucket),
    signPath(data.heading_font_path, bucket),
    signPath(data.body_font_path, bucket),
  ]);

  return {
    kit: rowToKit(data),
    logoUrl,
    logoMediaType: data.logo_media_type,
    headingFontUrl,
    headingFontMediaType: data.heading_font_media_type,
    bodyFontUrl,
    bodyFontMediaType: data.body_font_media_type,
  };
}

export type BrandingAssetUpload = {
  bytes: Buffer;
  mediaType: string;
  /** filename only, no folder. Folder is always `<userId>/`. */
  filenameStem: "logo" | "heading-font" | "body-font";
};

export type UpsertBrandingInput = {
  userId: string;
  kit: BrandingKit;
  logo?: BrandingAssetUpload | null;
  headingFont?: BrandingAssetUpload | null;
  bodyFont?: BrandingAssetUpload | null;
  removeLogo?: boolean;
  removeHeadingFont?: boolean;
  removeBodyFont?: boolean;
};

function ensureAllowedAsset(
  asset: BrandingAssetUpload | null | undefined,
  kind: "logo" | "font",
): asset is BrandingAssetUpload {
  if (!asset) return false;
  if (asset.bytes.byteLength === 0) {
    throw new BrandingStoreError(
      `Empty ${kind} upload`,
      "EMPTY_UPLOAD",
      400,
    );
  }
  if (kind === "logo") {
    if (asset.bytes.byteLength > MAX_LOGO_BYTES) {
      throw new BrandingStoreError(
        `Logo must be at most ${MAX_LOGO_BYTES / (1024 * 1024)} MB`,
        "LOGO_TOO_LARGE",
        400,
      );
    }
    if (!ALLOWED_LOGO_TYPES.has(asset.mediaType)) {
      throw new BrandingStoreError(
        "Logo must be JPEG, PNG, or WebP",
        "INVALID_LOGO_TYPE",
        400,
      );
    }
  } else {
    if (asset.bytes.byteLength > MAX_FONT_BYTES) {
      throw new BrandingStoreError(
        `Font must be at most ${MAX_FONT_BYTES / (1024 * 1024)} MB`,
        "FONT_TOO_LARGE",
        400,
      );
    }
    if (!ALLOWED_FONT_TYPES.has(asset.mediaType)) {
      throw new BrandingStoreError(
        "Font must be WOFF2, WOFF, TTF, or OTF",
        "INVALID_FONT_TYPE",
        400,
      );
    }
  }
  return true;
}

export class BrandingStoreError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "BrandingStoreError";
  }
}

function pathFor(
  userId: string,
  asset: BrandingAssetUpload,
): string {
  if (asset.filenameStem === "logo") {
    return `${userId}/logo.${imageExtensionFromMediaType(asset.mediaType)}`;
  }
  return `${userId}/${asset.filenameStem}.${fontExtensionFromMediaType(
    asset.mediaType,
  )}`;
}

async function uploadAsset(
  bucket: string,
  userId: string,
  asset: BrandingAssetUpload,
  existingPath: string | null,
): Promise<{ path: string; mediaType: string }> {
  const supabase = createSupabaseAdminClient();
  const newPath = pathFor(userId, asset);

  const { error: uploadErr } = await supabase.storage
    .from(bucket)
    .upload(newPath, asset.bytes, {
      contentType: asset.mediaType,
      upsert: true,
      cacheControl: "3600",
    });
  if (uploadErr) {
    throw new BrandingStoreError(
      `Could not upload ${asset.filenameStem}: ${uploadErr.message}`,
      "UPLOAD_FAILED",
      502,
    );
  }

  if (existingPath && existingPath !== newPath) {
    await supabase.storage.from(bucket).remove([existingPath]);
  }

  return { path: newPath, mediaType: asset.mediaType };
}

async function removeAssetIfPresent(
  bucket: string,
  path: string | null,
): Promise<void> {
  if (!path) return;
  const supabase = createSupabaseAdminClient();
  await supabase.storage.from(bucket).remove([path]);
}

/**
 * Persists the kit row + uploads/removes asset files atomically-enough for our
 * needs: the row write happens last so a partial failure leaves prior asset
 * paths intact in the DB.
 */
export async function upsertBrandingKit(
  input: UpsertBrandingInput,
): Promise<BrandingKitView> {
  const {
    userId,
    kit,
    logo,
    headingFont,
    bodyFont,
    removeLogo,
    removeHeadingFont,
    removeBodyFont,
  } = input;
  if (!userId) {
    throw new BrandingStoreError("Missing user id", "UNAUTHENTICATED", 401);
  }

  const supabase = createSupabaseAdminClient();
  const bucket = brandingAssetsBucket();

  const { data: existing } = await supabase
    .from("branding_kits")
    .select(
      "logo_path, logo_media_type, heading_font_path, heading_font_media_type, body_font_path, body_font_media_type",
    )
    .eq("user_id", userId)
    .maybeSingle<{
      logo_path: string | null;
      logo_media_type: string | null;
      heading_font_path: string | null;
      heading_font_media_type: string | null;
      body_font_path: string | null;
      body_font_media_type: string | null;
    }>();

  let logoPath = existing?.logo_path ?? null;
  let logoMediaType = existing?.logo_media_type ?? null;
  let headingFontPath = existing?.heading_font_path ?? null;
  let headingFontMediaType = existing?.heading_font_media_type ?? null;
  let bodyFontPath = existing?.body_font_path ?? null;
  let bodyFontMediaType = existing?.body_font_media_type ?? null;

  if (removeLogo) {
    await removeAssetIfPresent(bucket, logoPath);
    logoPath = null;
    logoMediaType = null;
  }
  if (removeHeadingFont) {
    await removeAssetIfPresent(bucket, headingFontPath);
    headingFontPath = null;
    headingFontMediaType = null;
  }
  if (removeBodyFont) {
    await removeAssetIfPresent(bucket, bodyFontPath);
    bodyFontPath = null;
    bodyFontMediaType = null;
  }

  if (ensureAllowedAsset(logo ?? null, "logo")) {
    const uploaded = await uploadAsset(bucket, userId, logo!, logoPath);
    logoPath = uploaded.path;
    logoMediaType = uploaded.mediaType;
  }
  if (ensureAllowedAsset(headingFont ?? null, "font")) {
    const uploaded = await uploadAsset(
      bucket,
      userId,
      headingFont!,
      headingFontPath,
    );
    headingFontPath = uploaded.path;
    headingFontMediaType = uploaded.mediaType;
  }
  if (ensureAllowedAsset(bodyFont ?? null, "font")) {
    const uploaded = await uploadAsset(bucket, userId, bodyFont!, bodyFontPath);
    bodyFontPath = uploaded.path;
    bodyFontMediaType = uploaded.mediaType;
  }

  const { error: rowErr } = await supabase.from("branding_kits").upsert(
    {
      user_id: userId,
      version: 2,
      brand_name: kit.brandName,
      tagline: kit.tagline,
      primary_color: kit.primaryColor,
      secondary_color: kit.secondaryColor,
      accent_color: kit.accentColor,
      voice_tone: kit.voiceTone,
      extra_notes: kit.extraNotes,
      heading_typography: kit.headingTypography,
      body_typography: kit.bodyTypography,
      logo_path: logoPath,
      logo_media_type: logoMediaType,
      heading_font_path: headingFontPath,
      heading_font_media_type: headingFontMediaType,
      body_font_path: bodyFontPath,
      body_font_media_type: bodyFontMediaType,
    },
    { onConflict: "user_id" },
  );

  if (rowErr) {
    throw new BrandingStoreError(
      `Could not save branding row: ${rowErr.message}`,
      "ROW_WRITE_FAILED",
      502,
    );
  }

  return getBrandingKitView(userId);
}

/**
 * Server-side hydration for the generate route. Pulls the branding row +
 * downloads the logo bytes from storage so the model call gets the binary.
 */
export async function loadBrandingKitForGenerate(userId: string): Promise<{
  view: BrandingKitView;
  logoBuffer: Buffer | null;
  logoMediaType: string | null;
}> {
  if (!userId) {
    return { view: DEFAULT_BRANDING_KIT_VIEW, logoBuffer: null, logoMediaType: null };
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("branding_kits")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle<BrandingRow>();

  if (error || !data) {
    return { view: DEFAULT_BRANDING_KIT_VIEW, logoBuffer: null, logoMediaType: null };
  }

  const bucket = brandingAssetsBucket();
  const [logoUrl, headingFontUrl, bodyFontUrl] = await Promise.all([
    signPath(data.logo_path, bucket),
    signPath(data.heading_font_path, bucket),
    signPath(data.body_font_path, bucket),
  ]);

  let logoBuffer: Buffer | null = null;
  let logoMediaType: string | null = null;
  if (data.logo_path) {
    const { data: blob, error: dlErr } = await supabase.storage
      .from(bucket)
      .download(data.logo_path);
    if (!dlErr && blob) {
      const arrayBuffer = await blob.arrayBuffer();
      logoBuffer = Buffer.from(arrayBuffer);
      logoMediaType = data.logo_media_type ?? blob.type ?? null;
    }
  }

  return {
    view: {
      kit: rowToKit(data),
      logoUrl,
      logoMediaType: data.logo_media_type,
      headingFontUrl,
      headingFontMediaType: data.heading_font_media_type,
      bodyFontUrl,
      bodyFontMediaType: data.body_font_media_type,
    },
    logoBuffer,
    logoMediaType,
  };
}

export { DEFAULT_BRANDING_KIT, DEFAULT_BRANDING_KIT_VIEW };
