"use client";

import type { Org } from "@/lib/demo/types";
import { drawBrandBar, drawCard, drawLowerThird, drawPreviewBadge, fade, loadImage, type CardLine } from "./overlay";
import { recordCanvas, VIDEO_SIZE } from "./record";

const INTRO = 2200;
const OUTRO = 2800;
const DIP = 250;

export type MontageClip = { src: string; caption?: string; subtitle?: string };

function loadVideo(src: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.onloadeddata = () => resolve(v);
    v.onerror = () => reject(new Error("Nie można odczytać klipu."));
    v.src = src;
  });
}

/** Joins AI room clips into one branded film: intro card, clips with room captions, outro card. */
export async function recordMontage(
  clips: MontageClip[],
  org: Org,
  format: keyof typeof VIDEO_SIZE,
  cards: { intro: CardLine[]; outro: CardLine[] },
  onProgress?: (p: number) => void,
) {
  if (!clips.length) throw new Error("Brak klipów do połączenia.");
  const { w: W, h: H } = VIDEO_SIZE[format];
  const s = format === "9:16" ? 1 : 1.05;
  const videos = await Promise.all(clips.map((c) => loadVideo(c.src)));
  const logo = org.logo ? await loadImage(org.logo).catch(() => null) : null;

  const starts: number[] = [];
  let t = INTRO;
  for (const v of videos) {
    starts.push(t);
    t += v.duration * 1000;
  }
  const clipsEnd = t;
  const duration = clipsEnd + OUTRO;

  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const g = out.getContext("2d")!;
  let playing = -1;

  const cover = (v: HTMLVideoElement) => {
    const k = Math.max(W / v.videoWidth, H / v.videoHeight);
    const w = v.videoWidth * k;
    const h = v.videoHeight * k;
    g.drawImage(v, (W - w) / 2, (H - h) / 2, w, h);
  };

  const draw = (time: number) => {
    let i = starts.findLastIndex((st) => time >= st);
    if (time >= clipsEnd) i = videos.length - 1;
    const intro = i < 0;
    const idx = Math.max(0, i);
    const v = videos[idx];
    if (!intro && time < clipsEnd && playing !== idx) {
      videos.forEach((x, j) => j !== idx && x.pause());
      v.currentTime = 0;
      void v.play();
      playing = idx;
    }
    if (time >= clipsEnd && playing !== -2) {
      v.pause();
      playing = -2;
    }
    g.fillStyle = "#111";
    g.fillRect(0, 0, W, H);
    cover(v);
    // short dip to black between rooms
    if (!intro && idx > 0) {
      const since = time - starts[idx];
      if (since < DIP) {
        g.fillStyle = `rgba(0,0,0,${1 - since / DIP})`;
        g.fillRect(0, 0, W, H);
      }
    }
    const cardA = Math.max(fade(time, 0, INTRO, 400), fade(time, clipsEnd, duration + 400, 400));
    if (cardA > 0) {
      g.fillStyle = `rgba(0,0,0,${0.3 * cardA})`;
      g.fillRect(0, 0, W, H);
    }
    drawBrandBar(g, W, s, org, logo);
    if (!intro && time < clipsEnd && clips[idx].caption) {
      const clipEnd = idx + 1 < starts.length ? starts[idx + 1] : clipsEnd;
      drawLowerThird(g, W, H, s, org.color, clips[idx].caption!, clips[idx].subtitle ?? "wizualizacja AI", fade(time - starts[idx], 300, clipEnd - starts[idx], 300));
    }
    drawCard(g, W, H, s, org.color, cards.intro, fade(time, 150, INTRO - 100, 400));
    drawCard(g, W, H, s, org.color, cards.outro, fade(time, clipsEnd, duration + 400, 400), "bottom");
    drawPreviewBadge(g, W, H, s);
  };

  try {
    return await recordCanvas(out, duration, draw, onProgress);
  } finally {
    videos.forEach((v) => {
      v.pause();
      v.removeAttribute("src");
      v.load();
    });
  }
}
