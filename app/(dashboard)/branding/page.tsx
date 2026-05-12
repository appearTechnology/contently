import { BrandingKitForm } from "@/components/branding-kit-form";
import { getAuthenticatedUserId } from "@/lib/supabase/server";
import { getBrandingKitView } from "@/lib/branding/server-store";
import { DEFAULT_BRANDING_KIT_VIEW } from "@/lib/branding/types";

export const dynamic = "force-dynamic";

export default async function BrandingPage() {
  const userId = await getAuthenticatedUserId();
  const initialView = userId
    ? await getBrandingKitView(userId)
    : DEFAULT_BRANDING_KIT_VIEW;
  return <BrandingKitForm initialView={initialView} />;
}
