"use client";

import { useState } from "react";

/** Drag slider: developer state (before) vs furnished (after), both rendered from the 3D model. */
export function BeforeAfter({ before, after, alt }: { before?: string; after: string; alt: string }) {
  const [pos, setPos] = useState(50);
  return (
    <div className="relative aspect-[4/3] select-none overflow-hidden rounded-2xl bg-stone-200">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={after} alt={`${alt}: umeblowane`} className="absolute inset-0 h-full w-full object-cover" />
      {before && (
        <>
          <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={before} alt={`${alt}: stan deweloperski`} className="absolute inset-0 h-full w-full object-cover" />
          </div>
          <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${pos}%` }}>
            <span className="absolute top-1/2 left-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-xs font-semibold text-stone-700 shadow">
              ⇆
            </span>
          </div>
          <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-xs text-white">Stan deweloperski</span>
          <span className="absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-xs text-white">Umeblowane</span>
          <input
            type="range"
            min={0}
            max={100}
            value={pos}
            onChange={(e) => setPos(Number(e.target.value))}
            aria-label="Porównaj stan deweloperski i umeblowanie"
            className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
          />
        </>
      )}
    </div>
  );
}
