import type { RoomInput } from "@/lib/plan/autoLayout";
import type { Plan } from "@/lib/plan/types";

/**
 * Demo data model (browser only). Mirrors the planned Postgres tables
 * (offers, rooms, photos, generations) so the UI can move to Supabase in M1–M2.
 */

/** "idb:<key>" for files kept in IndexedDB, otherwise a URL (e.g. /demo/...). */
export type MediaRef = string;

export type Photo = {
  id: string;
  src: MediaRef;
  roomName?: string;
};

/** Room image rendered from our own 3D model: developer state (before) and furnished (after). No AI. */
export type RoomRender = {
  id: string;
  roomName: string;
  before: MediaRef;
  after: MediaRef;
};

export type VideoKind = "tour3d" | "reel" | "photo3d";

export type Video = {
  id: string;
  kind: VideoKind;
  format: "9:16" | "16:9";
  src: MediaRef;
  mime: string;
  createdAt: number;
  roomName?: string;
};

export type Style = "skandynawski" | "nowoczesny" | "klasyczny" | "loft";

export type Offer = {
  id: string;
  slug: string;
  createdAt: number;
  sample?: boolean;
  title: string;
  street: string;
  city: string;
  district: string;
  area: number;
  price: number;
  floor: string;
  style: Style;
  description: string;
  agent: { name: string; phone: string; email: string };
  consentOwner: boolean;
  rooms: RoomInput[];
  plan: Plan;
  photos: Photo[];
  renders: RoomRender[];
  videos: Video[];
};

export type Org = {
  name: string;
  color: string;
  logo?: string;
};

export const STYLE_LABELS: Record<Style, string> = {
  skandynawski: "Skandynawski",
  nowoczesny: "Nowoczesny",
  klasyczny: "Klasyczny",
  loft: "Loft",
};
