import {
  DEFAULT_BRANDING_KIT_VIEW,
  type BrandingKit,
  type BrandingKitView,
} from "@/lib/branding/types";

/** Pending binary uploads collected by the form before a Save click. */
export type BrandingPendingFiles = {
  logo?: File | null;
  secondaryLogo?: File | null;
  icon?: File | null;
  headingFont?: File | null;
  bodyFont?: File | null;
};

/** Explicit removal flags so the user can clear an asset without a new upload. */
export type BrandingRemoveFlags = {
  removeLogo?: boolean;
  removeSecondaryLogo?: boolean;
  removeIcon?: boolean;
  removeHeadingFont?: boolean;
  removeBodyFont?: boolean;
};

/**
 * Fetches the signed-in user's branding view from the server.
 * Used by client-side hydration paths; server components should call
 * `getBrandingKitView` from `lib/branding/server-store.ts` directly.
 */
export async function fetchBrandingKitView(): Promise<BrandingKitView> {
  try {
    const res = await fetch("/api/branding", { method: "GET" });
    if (!res.ok) return DEFAULT_BRANDING_KIT_VIEW;
    const data = (await res.json()) as { view?: BrandingKitView };
    return data.view ?? DEFAULT_BRANDING_KIT_VIEW;
  } catch {
    return DEFAULT_BRANDING_KIT_VIEW;
  }
}

export type SaveBrandingResult =
  | { ok: true; view: BrandingKitView }
  | { ok: false; error: string; hint?: string };

/**
 * Persists the kit text fields and any pending binary uploads in a single
 * multipart PUT to the server. Returns the refreshed view.
 */
export async function saveBrandingKit(
  kit: BrandingKit,
  files: BrandingPendingFiles = {},
  remove: BrandingRemoveFlags = {},
): Promise<SaveBrandingResult> {
  const form = new FormData();
  form.set("kit", JSON.stringify(kit));
  if (files.logo) form.set("logo", files.logo);
  if (files.secondaryLogo) form.set("secondaryLogo", files.secondaryLogo);
  if (files.icon) form.set("icon", files.icon);
  if (files.headingFont) form.set("headingFont", files.headingFont);
  if (files.bodyFont) form.set("bodyFont", files.bodyFont);
  if (remove.removeLogo) form.set("removeLogo", "1");
  if (remove.removeSecondaryLogo) form.set("removeSecondaryLogo", "1");
  if (remove.removeIcon) form.set("removeIcon", "1");
  if (remove.removeHeadingFont) form.set("removeHeadingFont", "1");
  if (remove.removeBodyFont) form.set("removeBodyFont", "1");

  try {
    const res = await fetch("/api/branding", { method: "PUT", body: form });
    const data = (await res.json()) as {
      view?: BrandingKitView;
      error?: string;
      hint?: string;
    };
    if (!res.ok || !data.view) {
      return {
        ok: false,
        error: data.error ?? "Could not save branding.",
        ...(typeof data.hint === "string" && data.hint
          ? { hint: data.hint }
          : {}),
      };
    }
    return { ok: true, view: data.view };
  } catch {
    return { ok: false, error: "Network error while saving branding." };
  }
}
