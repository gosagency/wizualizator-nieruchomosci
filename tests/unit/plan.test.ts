import { describe, expect, it } from "vitest";
import { autoLayout, type RoomInput } from "@/lib/plan/autoLayout";
import { checkArea } from "@/lib/plan/area";
import { PODGORZE_PLAN } from "@/lib/plan/podgorze";
import type { Rect } from "@/lib/plan/types";

const rectArea = ([x0, x1, z0, z1]: Rect) => (x1 - x0) * (z1 - z0);
const overlaps = (a: Rect, b: Rect) =>
  Math.min(a[1], b[1]) - Math.max(a[0], b[0]) > 0.01 && Math.min(a[3], b[3]) - Math.max(a[2], b[2]) > 0.01;

const THREE_ROOMS: RoomInput[] = [
  { name: "Salon z aneksem", kind: "salon", area: 22 },
  { name: "Sypialnia", kind: "sypialnia", area: 12.5 },
  { name: "Pokój", kind: "pokoj", area: 9.5 },
  { name: "Łazienka", kind: "lazienka", area: 5 },
  { name: "WC", kind: "wc", area: 1.5 },
  { name: "Przedpokój", kind: "przedpokoj", area: 7 },
  { name: "Balkon", kind: "balkon", area: 4 },
];

describe("checkArea", () => {
  it("accepts the sample apartment (58 m²) and ignores the balcony", () => {
    expect(checkArea(PODGORZE_PLAN.rooms, 58)).toEqual({ sum: 58, diff: 0, ok: true });
  });

  it("rejects a difference above 0,5 m²", () => {
    expect(checkArea([{ area: 30 }, { area: 20 }], 51).ok).toBe(false);
    expect(checkArea([{ area: 30 }, { area: 20.6 }], 51).ok).toBe(true);
  });
});

describe("autoLayout", () => {
  const plan = autoLayout(THREE_ROOMS);

  it("keeps every room's area", () => {
    for (const input of THREE_ROOMS) {
      const room = plan.rooms.find((r) => r.name === input.name)!;
      const drawn = room.rects.reduce((s, r) => s + rectArea(r), 0);
      expect(drawn).toBeCloseTo(input.area, 1);
    }
  });

  it("places rooms without overlaps", () => {
    const rects = plan.rooms.flatMap((r) => r.rects);
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++) expect(overlaps(rects[i], rects[j])).toBe(false);
  });

  it("gives the flat an entrance door and the balcony a glass door", () => {
    expect(plan.walls.some((w) => w.op.some((o) => o.door))).toBe(true);
    expect(plan.balcony).toBeDefined();
    const [bx0, bx1] = plan.balcony!.rect;
    const north = plan.walls.find((w) => w.ax === "x" && w.c === 0)!;
    expect(north.op.some((o) => o.glass && o.y0 === 0 && o.a >= bx0 && o.b <= bx1)).toBe(true);
  });

  it("keeps a usable corridor and room depths", () => {
    const hall = plan.rooms.find((r) => r.kind === "przedpokoj")!;
    const [, , z0, z1] = hall.rects[0];
    expect(z1 - z0).toBeGreaterThanOrEqual(1.1);
    expect(z1 - z0).toBeLessThanOrEqual(2.2);
    for (const r of plan.rooms.filter((r) => !r.extra && r.kind !== "przedpokoj" && r.kind !== "wc")) {
      const [x0, x1, rz0, rz1] = r.rects[0];
      expect(Math.min(x1 - x0, rz1 - rz0)).toBeGreaterThan(1.4);
    }
  });

  it("works for a studio without a balcony", () => {
    const studio = autoLayout([
      { name: "Pokój z aneksem", kind: "salon", area: 20 },
      { name: "Łazienka", kind: "lazienka", area: 4 },
      { name: "Przedpokój", kind: "przedpokoj", area: 4 },
    ]);
    expect(studio.rooms).toHaveLength(3);
    expect(studio.balcony).toBeUndefined();
    expect(studio.furniture.length).toBeGreaterThan(3);
  });
});
