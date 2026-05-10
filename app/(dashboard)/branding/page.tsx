import { auth } from "@clerk/nextjs/server";
import { BrandingKitForm } from "@/components/branding-kit-form";
import { getBrandingKitView } from "@/lib/branding/server-store";
import { DEFAULT_BRANDING_KIT_VIEW } from "@/lib/branding/types";

export const dynamic = "force-dynamic";

export default async function BrandingPage() {
  const { userId } = await auth();
  const initialView = userId
    ? await getBrandingKitView(userId)
    : DEFAULT_BRANDING_KIT_VIEW;
  return <BrandingKitForm initialView={initialView} />;
}
