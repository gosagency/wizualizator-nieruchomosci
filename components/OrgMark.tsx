"use client";

import type { Org } from "@/lib/demo/types";

export function OrgMark({ org, size = 32 }: { org: Org; size?: number }) {
  if (org.logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={org.logo} alt="" style={{ height: size }} className="w-auto rounded-md object-contain" />;
  }
  const initials = org.name
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <span
      style={{ width: size, height: size, background: org.color, fontSize: size * 0.38 }}
      className="inline-flex shrink-0 items-center justify-center rounded-lg font-semibold text-white"
    >
      {initials || "B"}
    </span>
  );
}
