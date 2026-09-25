export type SupabasePublicEnv = {
  url: string;
  publishableKey: string;
};

type EnvSource = Record<string, string | undefined>;

/**
 * Returns public Supabase settings, or null when they are not configured yet.
 * Next.js inlines NEXT_PUBLIC_* only for direct `process.env.X` access,
 * so the default source reads them explicitly.
 */
export function getSupabasePublicEnv(
  source: EnvSource = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  },
): SupabasePublicEnv | null {
  const url = source.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = source.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}

export function requireSupabasePublicEnv(): SupabasePublicEnv {
  const env = getSupabasePublicEnv();
  if (!env) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.local.",
    );
  }
  return env;
}
