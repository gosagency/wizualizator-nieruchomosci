import { createBrowserClient } from "@supabase/ssr";
import { requireSupabasePublicEnv } from "@/lib/env";

/** Supabase client for Client Components. Uses only the publishable key. */
export function createClient() {
  const { url, publishableKey } = requireSupabasePublicEnv();
  return createBrowserClient(url, publishableKey);
}
