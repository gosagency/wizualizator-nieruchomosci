"use client";

import * as THREE from "three";
import type { Org } from "@/lib/demo/types";
import type { PhotoDepth } from "@/lib/depth/depth";
import { buildPhotoMesh, coverFov, disposeMesh, FOCUS } from "@/components/photo3d/photoMesh";
import { drawBrandBar, drawCard, drawLowerThird, drawPreviewBadge, easeInOut, fade, loadImage, type CardLine } from "./overlay";
import { recordCanvas, VIDEO_SIZE } from "./record";

const INTRO = 2400;
const SEG = 4600;
const XFADE = 600;
const OUTRO = 2800;

export type Photo3DItem = { depth: PhotoDepth; caption?: string; subtitle?: string };

/**
 * "Film 3D ze zdjęć": a camera glides through each photo turned into 3D
 * (depth estimated in the browser), with cross-fades and the office's branding.
 */
export async function recordPhoto3D(
  items: Photo3DItem[],
  org: Org,
  format: keyof typeof VIDEO_SIZE,
  cards: { intro?: CardLine[]; outro?: CardLine[] },
  onProgress?: (p: number) => void,
) {
  if (items.length === 0) throw new Error("Dodaj co najmniej jedno zdjęcie.");
  const { w: W, h: H } = VIDEO_SIZE[format];
  const s = format === "9:16" ? 1 : 1.05;

  const canvas = document.createElement("canvas");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  const shots = items.map((it) => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#111");
    const mesh = buildPhotoMesh(it.depth);
    scene.add(mesh);
    const camera = new THREE.PerspectiveCamera(coverFov(it.depth, W / H, 0.92), W / H, 0.05, 50);
    return { ...it, scene, mesh, camera };
  });
  const logo = org.logo ? await loadImage(org.logo).catch(() => null) : null;

  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const g = out.getContext("2d")!;
  const duration = INTRO + items.length * SEG + OUTRO;

  const renderShot = (i: number, k: number, alpha: number) => {
    const shot = shots[i];
    const dir = i % 2 ? -1 : 1;
    const e = easeInOut(Math.min(1, Math.max(0, k)));
    // one calm move per clip: dolly in with a slight arc (skill: one camera move per clip)
    shot.camera.position.set(dir * (-0.2 + 0.4 * e), 0.03 - 0.05 * e, 0.3 - 0.42 * e);
    shot.camera.lookAt(FOCUS);
    renderer.render(shot.scene, shot.camera);
    g.globalAlpha = alpha;
    g.drawImage(canvas, 0, 0, W, H);
    g.globalAlpha = 1;
  };

  const draw = (t: number) => {
    g.fillStyle = "#111";
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < shots.length; i++) {
      const last = i === shots.length - 1;
      const winStart = i === 0 ? 0 : INTRO + i * SEG - XFADE;
      const winEnd = INTRO + (i + 1) * SEG + (last ? OUTRO : XFADE);
      if (t < winStart || t > winEnd) continue;
      const alpha = i === 0 ? 1 : Math.min(1, (t - winStart) / XFADE);
      renderShot(i, (t - winStart) / (winEnd - winStart), alpha);
    }
    const cardA = Math.max(cards.intro ? fade(t, 0, INTRO, 400) : 0, fade(t, duration - OUTRO, duration + 400, 400));
    if (cardA > 0) {
      g.fillStyle = `rgba(0,0,0,${0.3 * cardA})`;
      g.fillRect(0, 0, W, H);
    }
    drawBrandBar(g, W, s, org, logo);
    const idx = Math.floor((t - INTRO) / SEG);
    if (idx >= 0 && idx < shots.length && shots[idx].caption) {
      drawLowerThird(g, W, H, s, org.color, shots[idx].caption!, shots[idx].subtitle ?? "wizualizacja 3D ze zdjęcia", fade(t - INTRO - idx * SEG, 300, SEG, 300));
    }
    if (cards.intro) drawCard(g, W, H, s, org.color, cards.intro, fade(t, 200, INTRO - 150, 400));
    if (cards.outro) drawCard(g, W, H, s, org.color, cards.outro, fade(t, duration - OUTRO, duration + 400, 400), "bottom");
    drawPreviewBadge(g, W, H, s);
  };

  try {
    return await recordCanvas(out, duration, draw, onProgress);
  } finally {
    shots.forEach((sh) => disposeMesh(sh.mesh));
    renderer.dispose();
  }
}
