"use client";

/** Picks the best format MediaRecorder supports here: MP4 (Chrome/Edge/Safari) or WebM. */
export function pickFormat(): { mime: string; ext: "mp4" | "webm" } {
  const candidates: Array<[string, "mp4" | "webm"]> = [
    ["video/mp4;codecs=avc1.42E01F", "mp4"],
    ["video/mp4", "mp4"],
    ["video/webm;codecs=vp9", "webm"],
    ["video/webm", "webm"],
  ];
  for (const [mime, ext] of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mime)) return { mime, ext };
  }
  throw new Error("Ta przeglądarka nie umie nagrywać wideo. Użyj Chrome albo Edge.");
}

/**
 * Records a 2D canvas in real time. `draw(t)` paints the frame at t ms;
 * recording stops after `duration` ms.
 */
export function recordCanvas(
  canvas: HTMLCanvasElement,
  duration: number,
  draw: (t: number) => void,
  onProgress?: (p: number) => void,
): Promise<{ blob: Blob; mime: string }> {
  const { mime } = pickFormat();
  const stream = canvas.captureStream(30);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  const baseMime = mime.split(";")[0];

  return new Promise((resolve, reject) => {
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      resolve({ blob: new Blob(chunks, { type: baseMime }), mime: baseMime });
    };
    rec.onerror = () => reject(new Error("Nagrywanie przerwane"));
    draw(0);
    rec.start(250);
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = now - t0;
      draw(Math.min(t, duration));
      onProgress?.(Math.min(1, t / duration));
      if (t >= duration) {
        setTimeout(() => rec.state !== "inactive" && rec.stop(), 120);
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

export const VIDEO_SIZE = {
  "9:16": { w: 720, h: 1280 },
  "16:9": { w: 1280, h: 720 },
} as const;
