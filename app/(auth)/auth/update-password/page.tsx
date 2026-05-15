import { cookies } from "next/headers";
import { PASSWORD_RECOVERY_COOKIE } from "@/lib/auth/password-recovery";
import { getSupabaseAuthUser } from "@/lib/supabase/server";
import { UpdatePasswordPanel } from "./update-password-panel";

export default async function UpdatePasswordPage() {
  const [cookieStore, user] = await Promise.all([
    cookies(),
    getSupabaseAuthUser(),
  ]);
  const hasRecoveryMarker =
    cookieStore.get(PASSWORD_RECOVERY_COOKIE)?.value === "1";

  return <UpdatePasswordPanel canResetPassword={Boolean(user && hasRecoveryMarker)} />;
}

