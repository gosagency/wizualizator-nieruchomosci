"use client";

import { useOrg } from "@/lib/demo/store";

/** Applies the office's brand colour to the whole page (CSS variable --brand). */
export function BrandStyle({ color }: { color?: string }) {
  const org = useOrg();
  return <style>{`:root{--brand:${color ?? org.color}}`}</style>;
}
