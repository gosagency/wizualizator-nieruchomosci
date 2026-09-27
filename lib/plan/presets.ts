import { round1 } from "./area";
import type { RoomInput } from "./autoLayout";
import type { RoomKind } from "./types";

/** Typical split of the usable area, by number of rooms (1 = studio). */
const PRESETS: Record<number, Array<[string, RoomKind, number]>> = {
  1: [["Pokój z aneksem", "salon", 0.66], ["Łazienka", "lazienka", 0.16], ["Przedpokój", "przedpokoj", 0.18]],
  2: [["Salon z aneksem", "salon", 0.45], ["Sypialnia", "sypialnia", 0.27], ["Łazienka", "lazienka", 0.12], ["Przedpokój", "przedpokoj", 0.16]],
  3: [["Salon z aneksem", "salon", 0.36], ["Sypialnia", "sypialnia", 0.22], ["Pokój", "pokoj", 0.15], ["Łazienka", "lazienka", 0.11], ["Przedpokój", "przedpokoj", 0.16]],
  4: [["Salon z aneksem", "salon", 0.3], ["Sypialnia", "sypialnia", 0.17], ["Pokój", "pokoj", 0.13], ["Pokój dziecięcy", "dzieciecy", 0.12], ["Łazienka", "lazienka", 0.09], ["WC", "wc", 0.03], ["Przedpokój", "przedpokoj", 0.16]],
};

export const MAX_PRESET_ROOMS = 4;

/**
 * Room list with estimated areas that add up exactly to `area`.
 * With a separate kitchen the living room loses its kitchenette.
 */
export function presetRooms(count: number, area: number, opts: { separateKitchen?: boolean } = {}): RoomInput[] {
  const n = Math.max(1, Math.min(MAX_PRESET_ROOMS, Math.round(count)));
  const rows = PRESETS[n].map(([name, kind, share]) => ({ name, kind, share }));
  if (opts.separateKitchen) {
    const i = rows.findIndex((r) => r.kind === "salon");
    rows[i] = { name: n === 1 ? "Pokój" : "Salon", kind: "salon", share: rows[i].share - 0.1 };
    rows.splice(i + 1, 0, { name: "Kuchnia", kind: "kuchnia", share: 0.1 });
  }
  const rooms = rows.map(({ name, kind, share }) => ({ name, kind, area: round1(area * share) }));
  const diff = round1(area - rooms.reduce((s, r) => s + r.area, 0));
  const hall = rooms.find((r) => r.kind === "przedpokoj")!;
  hall.area = round1(hall.area + diff);
  return rooms;
}
