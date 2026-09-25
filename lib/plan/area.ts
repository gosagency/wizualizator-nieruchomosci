import type { Room } from "./types";

/** Allowed difference between room areas and the offer area (PRD: ±0,5 m²). */
export const AREA_TOLERANCE = 0.5;

export function roomsArea(rooms: Pick<Room, "area" | "extra">[]): number {
  return round1(rooms.filter((r) => !r.extra).reduce((sum, r) => sum + r.area, 0));
}

export function checkArea(rooms: Pick<Room, "area" | "extra">[], offerArea: number) {
  const sum = roomsArea(rooms);
  const diff = round1(sum - offerArea);
  return { sum, diff, ok: Math.abs(diff) <= AREA_TOLERANCE };
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

const plNumber = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const plInt = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 });

export function formatArea(n: number): string {
  return `${plNumber.format(n)} m²`;
}

export function formatPrice(n: number): string {
  return `${plInt.format(n)} zł`;
}
