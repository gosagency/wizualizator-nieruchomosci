"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_ORG, SAMPLE_OFFER } from "./sample";
import type { Offer, Org } from "./types";
import { deleteBlob } from "./blobs";

// v2: sample without external AI assets; older data is ignored.
const OFFERS_KEY = "wiz.offers.v2";
const ORG_KEY = "wiz.org.v2";

type State = { offers: Offer[]; org: Org };

const listeners = new Set<() => void>();
let state: State | null = null;
const SERVER_STATE: State = { offers: [SAMPLE_OFFER], org: DEFAULT_ORG };

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the demo keeps working in memory.
  }
}

function load(): State {
  if (!state) {
    state = { offers: read(OFFERS_KEY, [SAMPLE_OFFER]), org: { ...DEFAULT_ORG, ...read(ORG_KEY, DEFAULT_ORG) } };
  }
  return state;
}

function set(next: State) {
  state = next;
  write(OFFERS_KEY, next.offers);
  write(ORG_KEY, next.org);
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === OFFERS_KEY || e.key === ORG_KEY) {
      state = null;
      l();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

export function useStore(): State {
  return useSyncExternalStore(subscribe, load, () => SERVER_STATE);
}

/** True after hydration, when localStorage data is available. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function useOffers() {
  return useStore().offers;
}

export function useOffer(idOrSlug: string) {
  return useStore().offers.find((o) => o.id === idOrSlug || o.slug === idOrSlug);
}

export function useOrg() {
  return useStore().org;
}

export function saveOffer(offer: Offer) {
  const s = load();
  const exists = s.offers.some((o) => o.id === offer.id);
  set({ ...s, offers: exists ? s.offers.map((o) => (o.id === offer.id ? offer : o)) : [offer, ...s.offers] });
}

export function updateOffer(id: string, patch: (o: Offer) => Offer) {
  const s = load();
  set({ ...s, offers: s.offers.map((o) => (o.id === id ? patch(o) : o)) });
}

export async function removeOffer(id: string) {
  const s = load();
  const offer = s.offers.find((o) => o.id === id);
  set({ ...s, offers: s.offers.filter((o) => o.id !== id) });
  // RODO: deleting an offer deletes its files (PRD, section 8).
  if (offer) {
    const refs = [...offer.photos.map((p) => p.src), ...offer.videos.map((v) => v.src), ...offer.renders.flatMap((r) => [r.after, r.before])];
    await Promise.all(refs.filter((r) => r.startsWith("idb:")).map(deleteBlob));
  }
}

export function saveOrg(org: Org) {
  set({ ...load(), org });
}

export function resetDemo() {
  set({ offers: [SAMPLE_OFFER], org: DEFAULT_ORG });
}

export function slugify(text: string): string {
  const map: Record<string, string> = { ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z" };
  return text
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (c) => map[c])
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
