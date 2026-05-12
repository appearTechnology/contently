/** Public anon client — safe on server and in the browser (NEXT_PUBLIC_* only). */
export function supabaseAnonEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase env: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }
  return { url, anonKey };
}

export function trySupabaseAnonEnv(): { url: string; anonKey: string } | null {
  try {
    return supabaseAnonEnv();
  } catch {
    return null;
  }
}
