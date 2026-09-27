"use client";

import type { ImportedListing } from "./types";

export async function importListing(url: string): Promise<ImportedListing> {
  const res = await fetch("/api/import", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Nie udało się pobrać ogłoszenia.");
  return body as ImportedListing;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function tryFetch(url: string, name: string): Promise<File | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return blob.type.startsWith("image/") ? new File([blob], name, { type: blob.type }) : null;
  } catch {
    return null; // CORS or network error
  }
}

/**
 * Directly from the portal CDN first (no load on our server); some CDN edges
 * answer without CORS headers, then through our relay /api/import/image.
 * CDNs throttle bursts, so the relay gets one retry after a short pause.
 */
async function fetchPhoto(url: string, name: string): Promise<File | null> {
  const direct = await tryFetch(url, name);
  if (direct) return direct;
  const relay = `/api/import/image?url=${encodeURIComponent(url)}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const file = await tryFetch(relay, name);
    if (file) return file;
    await wait(900);
  }
  return null;
}

/** Downloads listing photos in the browser, 3 at a time (portal CDNs allow CORS); failed ones are skipped. */
export async function downloadPhotos(urls: string[], limit = 12, onProgress?: (done: number, total: number) => void): Promise<File[]> {
  const list = urls.slice(0, limit);
  const files: Array<File | null> = new Array(list.length).fill(null);
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < list.length) {
      const i = next++;
      files[i] = await fetchPhoto(list[i], `zdjecie-${i + 1}.jpg`);
      onProgress?.(++done, list.length);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  return files.filter((f): f is File => !!f);
}
