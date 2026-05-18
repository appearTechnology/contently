import { BrandingDnaForm } from "@/components/branding-dna-form";
import { getAuthenticatedUserId } from "@/lib/supabase/server";
import { parseBrandDNARow } from "@/lib/branding/import-url-new/parse";
import { db } from "@/lib/db";
import { brandDna } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function BrandingPage() {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    redirect("/login");
  }

  const [row] = await db
    .select()
    .from(brandDna)
    .where(eq(brandDna.userId, userId))
    .orderBy(desc(brandDna.updatedAt))
    .limit(1);

  const initialDna = row ? parseBrandDNARow(row) : null;

  return <BrandingDnaForm initialDna={initialDna} />;
}
