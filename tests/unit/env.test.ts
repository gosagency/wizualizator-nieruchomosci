import { describe, expect, it } from "vitest";
import { getSupabasePublicEnv } from "@/lib/env";

describe("getSupabasePublicEnv", () => {
  it("returns null when Supabase is not configured", () => {
    expect(getSupabasePublicEnv({})).toBeNull();
    expect(
      getSupabasePublicEnv({ NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" }),
    ).toBeNull();
  });

  it("returns trimmed values when both are set", () => {
    expect(
      getSupabasePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: " http://127.0.0.1:54321 ",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      }),
    ).toEqual({ url: "http://127.0.0.1:54321", publishableKey: "sb_publishable_test" });
  });
});
