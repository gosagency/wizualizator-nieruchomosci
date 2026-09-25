"use client";

import { useEffect } from "react";
import { putBlob } from "./blobs";
import { updateOffer } from "./store";
import type { Offer, RoomRender } from "./types";

const inflight = new Map<string, Promise<void>>();

/** Renders room images from the 3D model once per offer and stores them with the offer. */
export function ensureRoomViews(offer: Offer): Promise<void> {
  if (offer.renders.length > 0) return Promise.resolve();
  const running = inflight.get(offer.id);
  if (running) return running;
  const job = (async () => {
    const { renderRoomViews } = await import("@/lib/video/views");
    const views = await renderRoomViews(offer.plan);
    const renders: RoomRender[] = await Promise.all(
      views.map(async (v) => ({
        id: `${offer.id}-${v.roomId}`,
        roomName: v.roomName,
        before: await putBlob(v.empty),
        after: await putBlob(v.furnished),
      })),
    );
    updateOffer(offer.id, (o) => (o.renders.length ? o : { ...o, renders }));
  })().finally(() => inflight.delete(offer.id));
  inflight.set(offer.id, job);
  return job;
}

/** Makes sure every given offer has its room images (runs one offer at a time). */
export function useRoomViews(offers: Offer[]) {
  const missing = offers.filter((o) => o.renders.length === 0).map((o) => o.id).join(",");
  useEffect(() => {
    if (!missing) return;
    let alive = true;
    (async () => {
      for (const o of offers) {
        if (!alive) return;
        if (o.renders.length === 0) await ensureRoomViews(o).catch(() => undefined);
      }
    })();
    return () => {
      alive = false;
    };
    // Re-run only when the set of offers without images changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missing]);
}
