"use client";

import { useMediaUrl } from "@/lib/demo/blobs";
import type { Offer } from "@/lib/demo/types";

/** First room image or photo; falls back to a drawn floor plan. */
export function OfferThumb({ offer, className = "" }: { offer: Offer; className?: string }) {
  const ref = offer.renders[0]?.after ?? offer.photos[0]?.src;
  const url = useMediaUrl(ref);
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className={`object-cover ${className}`} />;
  }
  return <PlanSketch offer={offer} className={className} />;
}

export function PlanSketch({ offer, className = "" }: { offer: Offer; className?: string }) {
  const [x0, x1, z0, z1] = offer.plan.bounds;
  const pad = 0.8;
  const minX = Math.min(x0, ...offer.plan.rooms.flatMap((r) => r.rects.map((q) => q[0]))) - pad;
  const minZ = Math.min(z0, ...offer.plan.rooms.flatMap((r) => r.rects.map((q) => q[2]))) - pad;
  const w = x1 - minX + pad;
  const h = z1 - minZ + pad;
  return (
    <svg viewBox={`${minX} ${minZ} ${w} ${h}`} className={`bg-stone-100 ${className}`} preserveAspectRatio="xMidYMid meet" aria-hidden>
      {offer.plan.rooms.flatMap((r) =>
        r.rects.map((q, i) => (
          <rect key={r.id + i} x={q[0]} y={q[2]} width={q[1] - q[0]} height={q[3] - q[2]} fill={r.extra ? "#e7e5e4" : r.floor === "tile" ? "#e2e8e4" : "#efe4d3"} stroke="none" />
        )),
      )}
      {offer.plan.walls.map((wl, i) =>
        wl.ax === "x" ? (
          <line key={i} x1={wl.a} x2={wl.b} y1={wl.c} y2={wl.c} stroke="#3c4440" strokeWidth={wl.t} />
        ) : (
          <line key={i} x1={wl.c} x2={wl.c} y1={wl.a} y2={wl.b} stroke="#3c4440" strokeWidth={wl.t} />
        ),
      )}
    </svg>
  );
}
