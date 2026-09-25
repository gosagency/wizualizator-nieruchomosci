"use client";

import type { Offer, Org } from "@/lib/demo/types";
import { getBlob } from "@/lib/demo/blobs";
import { formatArea, formatPrice } from "@/lib/plan/area";
import { drawBrandBar, drawCard, drawLowerThird, drawPreviewBadge, fade, loadImage, publicLinkText } from "./overlay";
import { recordCanvas, VIDEO_SIZE } from "./record";

const INTRO = 2800;
const SLIDE = 2800;
const XFADE = 500;
const OUTRO = 3200;

/**
 * "Rolka ze zdjęć": Ken Burns slideshow of the listing photos with price,
 * room captions and the office's branding. Uses agent photos and 3D room images.
 */
export async function recordReel(offer: Offer, org: Org, format: keyof typeof VIDEO_SIZE, onProgress?: (p: number) => void) {
  const { w: W, h: H } = VIDEO_SIZE[format];
  const s = format === "9:16" ? 1 : 1.05;

  // Agent photos first, then room images rendered from the 3D model.
  const sources = [
    ...offer.photos.map((p) => ({ src: p.src, caption: p.roomName, view: false })),
    ...offer.renders.map((r) => ({ src: r.after, caption: r.roomName, view: true })),
  ];
  if (sources.length === 0) throw new Error("Brak zdjęć i wizualizacji pokoi. Otwórz zakładkę „Zdjęcia i wizualizacje” i spróbuj ponownie.");

  const slides = await Promise.all(
    sources.map(async (x) => {
      const blob = await getBlob(x.src);
      if (!blob) throw new Error("Brak pliku zdjęcia");
      const url = URL.createObjectURL(blob);
      const img = await loadImage(url);
      return { ...x, img, url };
    }),
  );
  const logo = org.logo ? await loadImage(org.logo).catch(() => null) : null;

  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const g = out.getContext("2d")!;
  const duration = INTRO + slides.length * SLIDE + OUTRO;

  const rooms = offer.rooms.filter((r) => r.kind !== "balkon" && r.kind !== "przedpokoj" && r.kind !== "lazienka" && r.kind !== "wc").length;
  const introLines = [
    { text: `${offer.district ? offer.district + ", " : ""}${offer.city}`, size: 22, weight: 500, opacity: 0.85 },
    { text: offer.title, size: 40, weight: 700, gap: 14 },
    { text: formatPrice(offer.price), size: 34, weight: 700 },
    { text: `${formatArea(offer.area)} · ${rooms} ${rooms === 1 ? "pokój" : rooms < 5 ? "pokoje" : "pokoi"}`, size: 20, weight: 500, opacity: 0.85 },
  ];
  const outroLines = [
    { text: "Zobacz model 3D mieszkania", size: 30, weight: 700, gap: 14 },
    { text: publicLinkText(offer.slug), size: 22, weight: 500, opacity: 0.9, gap: 18 },
    { text: offer.agent.name, size: 22, weight: 600 },
    { text: offer.agent.phone, size: 22, weight: 500, opacity: 0.85 },
  ];

  const cover = (img: HTMLImageElement, zoom: number, panX: number, panY: number, alpha: number) => {
    const k = Math.max(W / img.width, H / img.height) * zoom;
    const w = img.width * k;
    const h = img.height * k;
    g.globalAlpha = alpha;
    g.drawImage(img, (W - w) / 2 + panX * (w - W) * 0.5, (H - h) / 2 + panY * (h - H) * 0.5, w, h);
    g.globalAlpha = 1;
  };

  const draw = (t: number) => {
    g.fillStyle = org.color;
    g.fillRect(0, 0, W, H);
    // Later slides are drawn over earlier ones, fading in: a cross-fade.
    for (let i = 0; i < slides.length; i++) {
      const last = i === slides.length - 1;
      const winStart = i === 0 ? 0 : INTRO + i * SLIDE - XFADE;
      const winEnd = INTRO + (i + 1) * SLIDE + (last ? OUTRO : XFADE);
      if (t < winStart || t > winEnd) continue;
      const k = (t - winStart) / (winEnd - winStart);
      const alpha = i === 0 ? 1 : Math.min(1, (t - winStart) / XFADE);
      const dir = i % 2 ? -1 : 1;
      cover(slides[i].img, 1.04 + k * 0.1, dir * (k - 0.5) * 0.6, 0, alpha);
    }
    // soften the image under the intro/outro cards
    const cardA = Math.max(fade(t, 0, INTRO, 400), fade(t, duration - OUTRO, duration + 400, 400));
    if (cardA > 0) {
      g.fillStyle = `rgba(0,0,0,${0.35 * cardA})`;
      g.fillRect(0, 0, W, H);
    }
    drawBrandBar(g, W, s, org, logo);
    const idx = Math.floor((t - INTRO) / SLIDE);
    if (idx >= 0 && idx < slides.length && slides[idx].caption) {
      const local = t - INTRO - idx * SLIDE;
      const room = offer.rooms.find((r) => r.name === slides[idx].caption);
      const sub = [room ? formatArea(room.area) : "", slides[idx].view ? "wizualizacja 3D" : "zdjęcie"].filter(Boolean).join(" · ");
      drawLowerThird(g, W, H, s, org.color, slides[idx].caption!, sub, fade(local, 250, SLIDE, 300));
    }
    drawCard(g, W, H, s, org.color, introLines, fade(t, 200, INTRO - 150, 400));
    drawCard(g, W, H, s, org.color, outroLines, fade(t, duration - OUTRO, duration + 400, 400));
    drawPreviewBadge(g, W, H, s);
  };

  try {
    return await recordCanvas(out, duration, draw, onProgress);
  } finally {
    slides.forEach((x) => URL.revokeObjectURL(x.url));
  }
}
