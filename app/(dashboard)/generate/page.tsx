import { AdCreativeForm } from "@/components/ad-creative-form-new";
import { getAuthenticatedUserId } from "@/lib/supabase/server";
import { parseBrandDNARow } from "@/lib/branding/import-url-new/parse";
import { db } from "@/lib/db";
import { brandDna } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function Page() {
  const userId = await getAuthenticatedUserId();

  const [row] = userId
    ? await db
      .select()
      .from(brandDna)
      .where(eq(brandDna.userId, userId))
      .orderBy(desc(brandDna.createdAt))
      .limit(1)
    : [];

  const dna = row ? parseBrandDNARow(row) : null;

  return <AdCreativeForm brandDna={dna} />;
}
