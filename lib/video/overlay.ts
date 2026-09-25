"use client";

/** Canvas drawing helpers shared by the 3D tour and the photo reel. */

export function fontFamily(): string {
  return getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
}

export function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

/** 0→1→0 envelope between start and end (ms). */
export function fade(t: number, start: number, end: number, ramp = 350): number {
  if (t < start || t > end) return 0;
  return Math.max(0, Math.min(1, (t - start) / ramp, (end - t) / ramp));
}

export function easeInOut(k: number) {
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
}

/** Small pill in the corner: required on every render, model and clip. */
export function drawPreviewBadge(g: CanvasRenderingContext2D, W: number, H: number, s: number) {
  const ff = fontFamily();
  g.save();
  g.font = `500 ${13 * s}px ${ff}`;
  const text = "Wizualizacja poglądowa";
  const tw = g.measureText(text).width;
  const pw = tw + 24 * s;
  const ph = 28 * s;
  const x = W - pw - 18 * s;
  const y = H - ph - 18 * s;
  g.fillStyle = "rgba(20,20,20,.5)";
  roundRect(g, x, y, pw, ph, ph / 2);
  g.fill();
  g.fillStyle = "#fff";
  g.textBaseline = "middle";
  g.fillText(text, x + 12 * s, y + ph / 2 + 1);
  g.restore();
}

export function drawBrandBar(
  g: CanvasRenderingContext2D,
  W: number,
  s: number,
  org: { name: string; color: string },
  logo?: HTMLImageElement | null,
) {
  const ff = fontFamily();
  g.save();
  const h = 64 * s;
  const grad = g.createLinearGradient(0, 0, 0, h * 1.6);
  grad.addColorStop(0, "rgba(0,0,0,.45)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, W, h * 1.6);
  let x = 22 * s;
  if (logo) {
    const lh = 34 * s;
    const lw = (logo.width / logo.height) * lh || lh;
    g.drawImage(logo, x, 16 * s, lw, lh);
    x += lw + 12 * s;
  } else {
    g.fillStyle = org.color;
    roundRect(g, x, 22 * s, 22 * s, 22 * s, 6 * s);
    g.fill();
    x += 32 * s;
  }
  g.fillStyle = "#fff";
  g.font = `600 ${18 * s}px ${ff}`;
  g.textBaseline = "middle";
  g.fillText(org.name, x, 33 * s + 1);
  g.restore();
}

/** Lower third: accent stripe, title, subtitle. */
export function drawLowerThird(
  g: CanvasRenderingContext2D,
  W: number,
  H: number,
  s: number,
  color: string,
  title: string,
  subtitle: string,
  alpha: number,
) {
  if (alpha <= 0) return;
  const ff = fontFamily();
  g.save();
  g.globalAlpha = alpha;
  const pad = 22 * s;
  g.font = `700 ${34 * s}px ${ff}`;
  const tw = g.measureText(title).width;
  g.font = `500 ${19 * s}px ${ff}`;
  const sw = g.measureText(subtitle).width;
  const w = Math.min(W - 44 * s, Math.max(tw, sw) + pad * 2 + 8 * s);
  const h = 96 * s;
  const x = 22 * s;
  const y = H - h - 70 * s + (1 - alpha) * 16 * s;
  g.fillStyle = "rgba(255,255,255,.93)";
  roundRect(g, x, y, w, h, 18 * s);
  g.fill();
  g.fillStyle = color;
  roundRect(g, x, y, 8 * s, h, 4 * s);
  g.fill();
  g.fillStyle = "#1c1917";
  g.textBaseline = "alphabetic";
  g.font = `700 ${34 * s}px ${ff}`;
  g.fillText(title, x + pad + 8 * s, y + 46 * s, w - pad * 2);
  g.fillStyle = "#57534e";
  g.font = `500 ${19 * s}px ${ff}`;
  g.fillText(subtitle, x + pad + 8 * s, y + 76 * s, w - pad * 2);
  g.restore();
}

export type CardLine = { text: string; size: number; weight?: number; opacity?: number; gap?: number };

/** Full card (intro / outro) centred on a brand-coloured panel. */
export function drawCard(
  g: CanvasRenderingContext2D,
  W: number,
  H: number,
  s: number,
  color: string,
  lines: CardLine[],
  alpha: number,
  anchor: "center" | "bottom" = "center",
) {
  if (alpha <= 0) return;
  const ff = fontFamily();
  g.save();
  g.globalAlpha = alpha;
  const pw = Math.min(W - 60 * s, 620 * s);
  const total = lines.reduce((h, l) => h + l.size * s * 1.25 + (l.gap ?? 10) * s, 0) + 50 * s;
  const x = (W - pw) / 2;
  const y = (anchor === "bottom" ? H - total - 70 * s : (H - total) / 2) + (1 - alpha) * 20 * s;
  g.fillStyle = color;
  roundRect(g, x, y, pw, total, 28 * s);
  g.fill();
  let cy = y + 30 * s;
  g.textAlign = "center";
  g.textBaseline = "top";
  for (const l of lines) {
    g.font = `${l.weight ?? 600} ${l.size * s}px ${ff}`;
    g.fillStyle = `rgba(255,255,255,${l.opacity ?? 1})`;
    g.fillText(l.text, W / 2, cy, pw - 40 * s);
    cy += l.size * s * 1.25 + (l.gap ?? 10) * s;
  }
  g.restore();
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Nie można wczytać obrazu ${src}`));
    img.src = src;
  });
}

/** Public link for video captions; a local dev address would look odd in a shared clip. */
export function publicLinkText(slug: string): string {
  const host = location.host;
  if (/^(localhost|127\.|\[::1\])/.test(host)) return "Link do modelu 3D w opisie";
  return `${host}/o/${slug}`;
}
