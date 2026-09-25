"use client";

import { useEffect, useState } from "react";
import type { MediaRef } from "./types";

const DB = "wizualizator";
const STORE = "files";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export async function putBlob(blob: Blob): Promise<MediaRef> {
  const key = crypto.randomUUID();
  await tx("readwrite", (s) => s.put(blob, key));
  return `idb:${key}`;
}

export async function getBlob(ref: MediaRef): Promise<Blob | undefined> {
  if (ref.startsWith("idb:")) return tx<Blob | undefined>("readonly", (s) => s.get(ref.slice(4)));
  const res = await fetch(ref);
  return res.ok ? res.blob() : undefined;
}

export async function deleteBlob(ref: MediaRef) {
  if (ref.startsWith("idb:")) await tx("readwrite", (s) => s.delete(ref.slice(4)));
}

/** Resolves a MediaRef to a URL usable in <img>/<video>. */
export function useMediaUrl(ref: MediaRef | undefined): string | undefined {
  const [loaded, setLoaded] = useState<{ ref: string; url: string } | null>(null);
  useEffect(() => {
    if (!ref?.startsWith("idb:")) return;
    let objectUrl: string | undefined;
    let alive = true;
    getBlob(ref).then((b) => {
      if (!alive || !b) return;
      objectUrl = URL.createObjectURL(b);
      setLoaded({ ref, url: objectUrl });
    });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [ref]);
  if (!ref) return undefined;
  if (!ref.startsWith("idb:")) return ref;
  return loaded?.ref === ref ? loaded.url : undefined;
}

/** Scales a photo down to max 2500 px on the long side (ROADMAP M2) and re-encodes as JPEG. */
export async function compressImage(file: File, max = 2500): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * k);
  const h = Math.round(bmp.height * k);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/jpeg", 0.86));
}
