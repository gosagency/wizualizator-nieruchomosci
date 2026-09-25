"use client";

/**
 * Client for our own video worker (video-worker/server.mjs): an open-source
 * image-to-video model (Wan 2.2, Apache-2.0) on our GPU. No paid AI service.
 * The worker address changes with each tunnel start, so it can come from the
 * build (NEXT_PUBLIC_VIDEO_WORKER_URL) or from the link (?serwer=https://…).
 */

const KEY = "wiz.videoWorker";

export type WorkerJob = { status: "queued" | "running" | "done" | "error"; progress?: number; position?: number; error?: string };

function clean(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.hostname === "127.0.0.1" || u.hostname === "localhost" ? u.origin : null;
  } catch {
    return null;
  }
}

/**
 * Order: ?serwer= in the link (remembered), then the address published with the
 * site (always current after `npm run wideo -- --publikuj`), then a remembered one.
 */
export function workerUrl(): string | null {
  if (typeof window === "undefined") return null;
  const fromLink = clean(new URLSearchParams(window.location.search).get("serwer"));
  const published = clean(process.env.NEXT_PUBLIC_VIDEO_WORKER_URL);
  try {
    if (fromLink) localStorage.setItem(KEY, fromLink);
    return fromLink ?? published ?? clean(localStorage.getItem(KEY));
  } catch {
    return fromLink ?? published;
  }
}

export async function workerHealth(base: string): Promise<{ ok: boolean; queue: number | null }> {
  try {
    const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(6000) });
    const body = await res.json();
    return { ok: res.ok && body.ok, queue: body.queue ?? null };
  } catch {
    return { ok: false, queue: null };
  }
}

async function toDataUrl(photo: Blob, max = 1920): Promise<string> {
  const bmp = await createImageBitmap(photo, { imageOrientation: "from-image" });
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c.toDataURL("image/jpeg", 0.9);
}

export async function submitJob(base: string, photo: Blob, room: string, format: "16:9" | "9:16"): Promise<string> {
  const res = await fetch(`${base}/jobs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ image: await toDataUrl(photo), room, format }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Serwer wideo odrzucił zadanie.");
  return body.id;
}

export async function jobStatus(base: string, id: string): Promise<WorkerJob> {
  const res = await fetch(`${base}/jobs/${id}`);
  if (!res.ok) return { status: "error", error: "Zadanie wygasło na serwerze wideo." };
  return res.json();
}

export async function fetchVideo(base: string, id: string): Promise<Blob> {
  const res = await fetch(`${base}/jobs/${id}/video`);
  if (!res.ok) throw new Error("Nie udało się pobrać filmu.");
  return res.blob();
}
