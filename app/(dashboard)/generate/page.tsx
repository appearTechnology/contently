import { auth } from "@clerk/nextjs/server";
import { AdCreativeForm } from "@/components/ad-creative-form";
import { brandingViewToMeta } from "@/lib/branding/format-prompt";
import { getBrandingKitView } from "@/lib/branding/server-store";
import {
  DEFAULT_BRANDING_KIT_VIEW,
  EMPTY_BRANDING_KIT_META,
} from "@/lib/branding/types";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { userId } = await auth();
  const view = userId
    ? await getBrandingKitView(userId)
    : DEFAULT_BRANDING_KIT_VIEW;
  const meta = userId ? brandingViewToMeta(view) : EMPTY_BRANDING_KIT_META;
  return <AdCreativeForm brandingMeta={meta} />;
}
