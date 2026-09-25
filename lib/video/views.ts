"use client";

import * as THREE from "three";
import type { Plan } from "@/lib/plan/types";
import { DAY_BG } from "@/components/model3d/apartmentScene";
import { drawPreviewBadge } from "./overlay";

export const VIEW_SIZE = { w: 1280, h: 960 } as const;

/** Rooms worth a picture of their own. */
const SKIP = new Set(["przedpokoj", "wc"]);

export type RenderedView = { roomId: string; roomName: string; empty: Blob; furnished: Blob };

/**
 * Room images rendered from our own 3D model (no AI, no external service):
 * each room from above with lowered walls, in developer state and furnished.
 */
export async function renderRoomViews(plan: Plan): Promise<RenderedView[]> {
  const { w: W, h: H } = VIEW_SIZE;
  const host = document.createElement("div");
  Object.assign(host.style, { position: "fixed", left: "-20000px", top: "0", width: `${W}px`, height: `${H}px` });
  document.body.appendChild(host);

  const { ApartmentScene } = await import("@/components/model3d/apartmentScene");
  const scene = new ApartmentScene(host, plan, { pixelRatio: 1, autoStart: false });
  scene.setCutaway(true);

  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const g = out.getContext("2d")!;
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, DAY_BG[0]);
  bg.addColorStop(1, DAY_BG[1]);
  const dir = new THREE.Vector3(-0.75, 1.15, 0.85).normalize();

  const shot = (pos: THREE.Vector3, target: THREE.Vector3): Promise<Blob> => {
    scene.renderPose(pos, target);
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    g.drawImage(scene.canvas, 0, 0, W, H);
    drawPreviewBadge(g, W, H, 1.3);
    return new Promise((resolve, reject) => out.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/jpeg", 0.88));
  };

  try {
    const views: RenderedView[] = [];
    for (const room of plan.rooms.filter((r) => !SKIP.has(r.kind))) {
      const xs = room.rects.flatMap((q) => [q[0], q[1]]);
      const zs = room.rects.flatMap((q) => [q[2], q[3]]);
      const target = new THREE.Vector3((Math.min(...xs) + Math.max(...xs)) / 2, 0.4, (Math.min(...zs) + Math.max(...zs)) / 2);
      const radius = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) / 2 + 1.1;
      const pos = target.clone().addScaledVector(dir, scene.fitDistance(radius));
      scene.setFurnished(false);
      const empty = await shot(pos, target);
      scene.setFurnished(true);
      const furnished = await shot(pos, target);
      views.push({ roomId: room.id, roomName: room.name, empty, furnished });
    }
    return views;
  } finally {
    scene.dispose();
    host.remove();
  }
}
