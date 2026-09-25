import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabasePublicEnv } from "@/lib/env";

/** Refreshes the Supabase auth session on every matched request. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const env = getSupabasePublicEnv();
  // Not configured yet (fresh clone): the app still runs, just without auth.
  if (!env) return response;

  const supabase = createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Do not put code between client creation and getClaims(): it refreshes the token.
  await supabase.auth.getClaims();

  return response;
}
