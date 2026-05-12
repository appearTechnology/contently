import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  brandingAssetsBucket,
  supabaseDashboardApiSettingsUrl,
  tryCreateSupabaseAdminClient,
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
import { normalizeVoiceToneTags } from "@/lib/branding/voice-tone-tags";
import {
  fontExtensionFromMediaType,
  imageExtensionFromMediaType,
} from "@/lib/branding/data-url";
import { ALLOWED_LOGO_MEDIA_TYPES } from "@/lib/branding/logo-media";
import { normalizeExtraPaletteColors } from "@/lib/branding/extra-palette-colors";

const SIGNED_URL_TTL_SECONDS = 60 * 60;
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
  palette_extras: unknown;
  voice_tone: string | null;
  voice_tone_tags: unknown;
  extra_notes: string | null;
  heading_typography: unknown;
  body_typography: unknown;
  logo_path: string | null;
  logo_media_type: string | null;
  secondary_logo_path: string | null;
  secondary_logo_media_type: string | null;
  icon_path: string | null;
  icon_media_type: string | null;
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
    extraPaletteColors: normalizeExtraPaletteColors(row.palette_extras),
    headingTypography: parseTypography(row.heading_typography),
    bodyTypography: parseTypography(row.body_typography),
    voiceTone: row.voice_tone ?? "",
    voiceToneTags: normalizeVoiceToneTags(row.voice_tone_tags),
    extraNotes: row.extra_notes ?? "",
  };
}

async function signPath(
  supabase: SupabaseClient,
  path: string | null,
  bucket: string,
): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/**
 * Returns the kit view for the given Supabase Auth user id. Resolves to the default
 * (empty) view if the row does not yet exist — caller can insert on first save.
 */
export async function getBrandingKitView(
  userId: string,
): Promise<BrandingKitView> {
  if (!userId) return DEFAULT_BRANDING_KIT_VIEW;
  const supabase = tryCreateSupabaseAdminClient();
  if (!supabase) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[branding] Supabase admin key missing — returning empty kit. Set SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY in .env.local.",
      );
    }
    return DEFAULT_BRANDING_KIT_VIEW;
  }
  const { data, error } = await supabase
    .from("branding_kits")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle<BrandingRow>();

  if (error || !data) return DEFAULT_BRANDING_KIT_VIEW;

  const bucket = brandingAssetsBucket();
  const [logoUrl, secondaryLogoUrl, iconUrl, headingFontUrl, bodyFontUrl] =
    await Promise.all([
      signPath(supabase, data.logo_path, bucket),
      signPath(supabase, data.secondary_logo_path, bucket),
      signPath(supabase, data.icon_path, bucket),
      signPath(supabase, data.heading_font_path, bucket),
      signPath(supabase, data.body_font_path, bucket),
    ]);

  return {
    kit: rowToKit(data),
    logoUrl,
    logoMediaType: data.logo_media_type,
    secondaryLogoUrl,
    secondaryLogoMediaType: data.secondary_logo_media_type,
    iconUrl,
    iconMediaType: data.icon_media_type,
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
  filenameStem:
    | "logo"
    | "secondary-logo"
    | "icon"
    | "heading-font"
    | "body-font";
};

export type UpsertBrandingInput = {
  userId: string;
  kit: BrandingKit;
  logo?: BrandingAssetUpload | null;
  secondaryLogo?: BrandingAssetUpload | null;
  icon?: BrandingAssetUpload | null;
  headingFont?: BrandingAssetUpload | null;
  bodyFont?: BrandingAssetUpload | null;
  removeLogo?: boolean;
  removeSecondaryLogo?: boolean;
  removeIcon?: boolean;
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
    if (!ALLOWED_LOGO_MEDIA_TYPES.has(asset.mediaType)) {
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

const POSTGREST_SCHEMA_HINT =
  "In the Supabase project used by this app: SQL Editor → paste and run the full script from supabase/repair-branding-kits.sql (adds columns + reloads the API schema). Then save again.";

function supabaseAdminHint(): string {
  const base =
    "Set SUPABASE_SERVICE_ROLE_KEY (service_role JWT) or SUPABASE_SECRET_KEY (sb_secret_…) in .env.local from the same project as NEXT_PUBLIC_SUPABASE_URL.";
  const dash = supabaseDashboardApiSettingsUrl();
  return dash ? `${base} Copy from: ${dash}` : `${base} Supabase → Dashboard → Settings → API.`;
}

export class BrandingStoreError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly hint?: string,
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
  if (asset.filenameStem === "secondary-logo") {
    return `${userId}/secondary-logo.${imageExtensionFromMediaType(asset.mediaType)}`;
  }
  if (asset.filenameStem === "icon") {
    return `${userId}/icon.${imageExtensionFromMediaType(asset.mediaType)}`;
  }
  return `${userId}/${asset.filenameStem}.${fontExtensionFromMediaType(
    asset.mediaType,
  )}`;
}

async function uploadAsset(
  supabase: SupabaseClient,
  bucket: string,
  userId: string,
  asset: BrandingAssetUpload,
  existingPath: string | null,
): Promise<{ path: string; mediaType: string }> {
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
      500,
    );
  }

  if (existingPath && existingPath !== newPath) {
    await supabase.storage.from(bucket).remove([existingPath]);
  }

  return { path: newPath, mediaType: asset.mediaType };
}

async function removeAssetIfPresent(
  supabase: SupabaseClient,
  bucket: string,
  path: string | null,
): Promise<void> {
  if (!path) return;
  await supabase.storage.from(bucket).remove([path]);
}

function columnFromPostgrestSchemaError(message: string): string | null {
  const m = message.match(/Could not find the '([^']+)' column/);
  return m?.[1] ?? null;
}

function stripIconRowKeys(row: Record<string, unknown>): void {
  delete row.icon_path;
  delete row.icon_media_type;
}

function stripSecondaryRowKeys(row: Record<string, unknown>): void {
  delete row.secondary_logo_path;
  delete row.secondary_logo_media_type;
}

function isPostgrestSchemaColumnOrCacheError(message: string): boolean {
  return (
    /schema cache/i.test(message) ||
    /Could not find the '[^']+' column/i.test(message)
  );
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
    secondaryLogo,
    icon,
    headingFont,
    bodyFont,
    removeLogo,
    removeSecondaryLogo,
    removeIcon,
    removeHeadingFont,
    removeBodyFont,
  } = input;
  if (!userId) {
    throw new BrandingStoreError("Missing user id", "UNAUTHENTICATED", 401);
  }

  const supabase = tryCreateSupabaseAdminClient();
  if (!supabase) {
    throw new BrandingStoreError(
      "Supabase server credentials are not configured.",
      "ADMIN_NOT_CONFIGURED",
      503,
      supabaseAdminHint(),
    );
  }
  const bucket = brandingAssetsBucket();

  const { data: existing } = await supabase
    .from("branding_kits")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle<BrandingRow>();

  let logoPath = existing?.logo_path ?? null;
  let logoMediaType = existing?.logo_media_type ?? null;
  let secondaryLogoPath = existing?.secondary_logo_path ?? null;
  let secondaryLogoMediaType = existing?.secondary_logo_media_type ?? null;
  let iconPath = existing?.icon_path ?? null;
  let iconMediaType = existing?.icon_media_type ?? null;
  let headingFontPath = existing?.heading_font_path ?? null;
  let headingFontMediaType = existing?.heading_font_media_type ?? null;
  let bodyFontPath = existing?.body_font_path ?? null;
  let bodyFontMediaType = existing?.body_font_media_type ?? null;

  if (removeLogo) {
    await removeAssetIfPresent(supabase, bucket, logoPath);
    logoPath = null;
    logoMediaType = null;
  }
  if (removeSecondaryLogo) {
    await removeAssetIfPresent(supabase, bucket, secondaryLogoPath);
    secondaryLogoPath = null;
    secondaryLogoMediaType = null;
  }
  if (removeIcon) {
    await removeAssetIfPresent(supabase, bucket, iconPath);
    iconPath = null;
    iconMediaType = null;
  }
  if (removeHeadingFont) {
    await removeAssetIfPresent(supabase, bucket, headingFontPath);
    headingFontPath = null;
    headingFontMediaType = null;
  }
  if (removeBodyFont) {
    await removeAssetIfPresent(supabase, bucket, bodyFontPath);
    bodyFontPath = null;
    bodyFontMediaType = null;
  }

  if (ensureAllowedAsset(logo ?? null, "logo")) {
    const uploaded = await uploadAsset(supabase, bucket, userId, logo!, logoPath);
    logoPath = uploaded.path;
    logoMediaType = uploaded.mediaType;
  }
  if (ensureAllowedAsset(secondaryLogo ?? null, "logo")) {
    const uploaded = await uploadAsset(
      supabase,
      bucket,
      userId,
      secondaryLogo!,
      secondaryLogoPath,
    );
    secondaryLogoPath = uploaded.path;
    secondaryLogoMediaType = uploaded.mediaType;
  }
  if (ensureAllowedAsset(icon ?? null, "logo")) {
    const uploaded = await uploadAsset(supabase, bucket, userId, icon!, iconPath);
    iconPath = uploaded.path;
    iconMediaType = uploaded.mediaType;
  }
  if (ensureAllowedAsset(headingFont ?? null, "font")) {
    const uploaded = await uploadAsset(
      supabase,
      bucket,
      userId,
      headingFont!,
      headingFontPath,
    );
    headingFontPath = uploaded.path;
    headingFontMediaType = uploaded.mediaType;
  }
  if (ensureAllowedAsset(bodyFont ?? null, "font")) {
    const uploaded = await uploadAsset(
      supabase,
      bucket,
      userId,
      bodyFont!,
      bodyFontPath,
    );
    bodyFontPath = uploaded.path;
    bodyFontMediaType = uploaded.mediaType;
  }

  const fullRow: Record<string, unknown> = {
    user_id: userId,
    version: 2,
    brand_name: kit.brandName,
    tagline: kit.tagline,
    primary_color: kit.primaryColor,
    secondary_color: kit.secondaryColor,
    accent_color: kit.accentColor,
    palette_extras: kit.extraPaletteColors,
    voice_tone: kit.voiceTone,
    voice_tone_tags: normalizeVoiceToneTags(kit.voiceToneTags),
    extra_notes: kit.extraNotes,
    heading_typography: kit.headingTypography,
    body_typography: kit.bodyTypography,
    logo_path: logoPath,
    logo_media_type: logoMediaType,
    secondary_logo_path: secondaryLogoPath,
    secondary_logo_media_type: secondaryLogoMediaType,
    icon_path: iconPath,
    icon_media_type: iconMediaType,
    heading_font_path: headingFontPath,
    heading_font_media_type: headingFontMediaType,
    body_font_path: bodyFontPath,
    body_font_media_type: bodyFontMediaType,
  };

  let row: Record<string, unknown> = { ...fullRow };
  let rowErr = (
    await supabase.from("branding_kits").upsert(row, { onConflict: "user_id" })
  ).error;

  let droppedPaletteExtrasForRetry = false;
  let droppedVoiceToneTagsForRetry = false;
  let guard = 0;
  const protectIconKeys = Boolean(icon) || removeIcon;
  const protectSecondaryKeys = Boolean(secondaryLogo) || removeSecondaryLogo;

  while (
    rowErr &&
    isPostgrestSchemaColumnOrCacheError(rowErr.message) &&
    guard++ < 24
  ) {
    const msg = rowErr.message ?? "";
    const col = columnFromPostgrestSchemaError(msg);

    if (col) {
      const isIcon =
        col === "icon_path" || col === "icon_media_type";
      const isSecondary =
        col === "secondary_logo_path" ||
        col === "secondary_logo_media_type";
      if (isIcon && protectIconKeys) {
        throw new BrandingStoreError(
          `Could not save branding row: ${msg}`,
          "ROW_WRITE_FAILED",
          500,
          POSTGREST_SCHEMA_HINT,
        );
      }
      if (isSecondary && protectSecondaryKeys) {
        throw new BrandingStoreError(
          `Could not save branding row: ${msg}`,
          "ROW_WRITE_FAILED",
          500,
          POSTGREST_SCHEMA_HINT,
        );
      }
      if (col === "palette_extras") droppedPaletteExtrasForRetry = true;
      if (col === "voice_tone_tags") droppedVoiceToneTagsForRetry = true;

      delete row[col];
      if (isIcon) stripIconRowKeys(row);
      if (isSecondary) stripSecondaryRowKeys(row);
    } else if (/schema cache/i.test(msg)) {
      if (!protectIconKeys && ("icon_path" in row || "icon_media_type" in row)) {
        stripIconRowKeys(row);
      } else if (
        !protectSecondaryKeys &&
        ("secondary_logo_path" in row ||
          "secondary_logo_media_type" in row)
      ) {
        stripSecondaryRowKeys(row);
      } else if ("voice_tone_tags" in row) {
        droppedVoiceToneTagsForRetry = true;
        delete row.voice_tone_tags;
      } else if ("palette_extras" in row) {
        droppedPaletteExtrasForRetry = true;
        delete row.palette_extras;
      } else {
        break;
      }
    } else {
      break;
    }

    rowErr = (
      await supabase.from("branding_kits").upsert(row, { onConflict: "user_id" })
    ).error;
  }

  if (rowErr) {
    const msg = rowErr.message ?? "";
    const schemaStale =
      /schema cache/i.test(msg) ||
      /Could not find the '[^']+' column/i.test(msg);
    throw new BrandingStoreError(
      `Could not save branding row: ${rowErr.message}`,
      "ROW_WRITE_FAILED",
      500,
      schemaStale ? POSTGREST_SCHEMA_HINT : undefined,
    );
  }

  if (
    droppedPaletteExtrasForRetry &&
    normalizeExtraPaletteColors(kit.extraPaletteColors).length > 0
  ) {
    throw new BrandingStoreError(
      "Extra palette colours could not be saved because the database API does not expose the palette_extras column yet. Run supabase/repair-branding-kits.sql in your Supabase SQL editor for this project, then try again.",
      "PALETTE_SCHEMA",
      500,
      POSTGREST_SCHEMA_HINT,
    );
  }
  if (
    droppedVoiceToneTagsForRetry &&
    normalizeVoiceToneTags(kit.voiceToneTags).length > 0
  ) {
    throw new BrandingStoreError(
      "Voice tone tags could not be saved because the database API does not expose the voice_tone_tags column yet. Run supabase/repair-branding-kits.sql in your Supabase SQL editor for this project, then try again.",
      "VOICE_TAGS_SCHEMA",
      500,
      POSTGREST_SCHEMA_HINT,
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
  secondaryLogoBuffer: Buffer | null;
  secondaryLogoMediaType: string | null;
  iconBuffer: Buffer | null;
  iconMediaType: string | null;
}> {
  if (!userId) {
    return {
      view: DEFAULT_BRANDING_KIT_VIEW,
      logoBuffer: null,
      logoMediaType: null,
      secondaryLogoBuffer: null,
      secondaryLogoMediaType: null,
      iconBuffer: null,
      iconMediaType: null,
    };
  }

  const supabase = tryCreateSupabaseAdminClient();
  if (!supabase) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[branding] Supabase admin key missing — generate will use empty branding assets.",
      );
    }
    return {
      view: DEFAULT_BRANDING_KIT_VIEW,
      logoBuffer: null,
      logoMediaType: null,
      secondaryLogoBuffer: null,
      secondaryLogoMediaType: null,
      iconBuffer: null,
      iconMediaType: null,
    };
  }

  const db = supabase;

  const { data, error } = await db
    .from("branding_kits")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle<BrandingRow>();

  if (error || !data) {
    return {
      view: DEFAULT_BRANDING_KIT_VIEW,
      logoBuffer: null,
      logoMediaType: null,
      secondaryLogoBuffer: null,
      secondaryLogoMediaType: null,
      iconBuffer: null,
      iconMediaType: null,
    };
  }

  const bucket = brandingAssetsBucket();
  const [logoUrl, secondaryLogoUrl, iconUrl, headingFontUrl, bodyFontUrl] =
    await Promise.all([
      signPath(db, data.logo_path, bucket),
      signPath(db, data.secondary_logo_path, bucket),
      signPath(db, data.icon_path, bucket),
      signPath(db, data.heading_font_path, bucket),
      signPath(db, data.body_font_path, bucket),
    ]);

  async function downloadLogo(
    path: string | null,
    rowMediaType: string | null,
  ): Promise<{ buffer: Buffer | null; mediaType: string | null }> {
    if (!path) return { buffer: null, mediaType: null };
    const { data: blob, error: dlErr } = await db.storage
      .from(bucket)
      .download(path);
    if (dlErr || !blob) return { buffer: null, mediaType: null };
    const arrayBuffer = await blob.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      mediaType: rowMediaType ?? blob.type ?? null,
    };
  }

  const primaryDl = await downloadLogo(data.logo_path, data.logo_media_type);
  const secondaryDl = await downloadLogo(
    data.secondary_logo_path,
    data.secondary_logo_media_type,
  );
  const iconDl = await downloadLogo(data.icon_path, data.icon_media_type);

  return {
    view: {
      kit: rowToKit(data),
      logoUrl,
      logoMediaType: data.logo_media_type,
      secondaryLogoUrl,
      secondaryLogoMediaType: data.secondary_logo_media_type,
      iconUrl,
      iconMediaType: data.icon_media_type,
      headingFontUrl,
      headingFontMediaType: data.heading_font_media_type,
      bodyFontUrl,
      bodyFontMediaType: data.body_font_media_type,
    },
    logoBuffer: primaryDl.buffer,
    logoMediaType: primaryDl.mediaType,
    secondaryLogoBuffer: secondaryDl.buffer,
    secondaryLogoMediaType: secondaryDl.mediaType,
    iconBuffer: iconDl.buffer,
    iconMediaType: iconDl.mediaType,
  };
}

export { DEFAULT_BRANDING_KIT, DEFAULT_BRANDING_KIT_VIEW };
