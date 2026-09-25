import { describe, expect, it } from "vitest";
import { autoLayout } from "@/lib/plan/autoLayout";
import { PODGORZE_PLAN } from "@/lib/plan/podgorze";
import { buildObstacles, collides, findPath, moveWithCollisions, roomAt, walkStart } from "@/lib/plan/walk";

const obstacles = buildObstacles(PODGORZE_PLAN);

/** Walks in small steps like the real controller does. */
function walk(from: { x: number; z: number }, to: { x: number; z: number }, obs = obstacles) {
  let p = { ...from };
  for (let i = 0; i < 400; i++) {
    const dx = to.x - p.x;
    const dz = to.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05) break;
    const s = Math.min(0.05, d);
    p = moveWithCollisions(p.x, p.z, (dx / d) * s, (dz / d) * s, obs);
  }
  return p;
}

describe("walk mode (Podgórze 58)", () => {
  it("starts inside the flat, in the hallway, not inside an obstacle", () => {
    const s = walkStart(PODGORZE_PLAN);
    expect(collides(s.x, s.z, obstacles)).toBe(false);
    expect(roomAt(PODGORZE_PLAN, s.x, s.z)?.id).toBe("hol");
  });

  it("cannot walk through the wall between the bedroom and the living room", () => {
    // living room (x < 5.2) → bedroom (x > 5.2) straight through the solid wall at z = 1.5
    const end = walk({ x: 4.6, z: 1.0 }, { x: 6.2, z: 1.0 });
    expect(end.x).toBeLessThan(5.2);
  });

  it("can walk from the hallway into the bathroom through its doorway", () => {
    const end = walk({ x: 6.0, z: 5.2 }, { x: 7.6, z: 5.2 });
    expect(roomAt(PODGORZE_PLAN, end.x, end.z)?.id).toBe("laz");
  });

  it("cannot leave through the entrance door or a window", () => {
    const s = walkStart(PODGORZE_PLAN);
    const out = walk(s, { x: s.x, z: 8 });
    expect(out.z).toBeLessThan(6.3);
    const window = walk({ x: 2.0, z: 1.0 }, { x: 2.0, z: -2 });
    expect(window.z).toBeGreaterThan(0);
  });

  it("does not walk through the bed", () => {
    expect(collides(6.3, 1.7, obstacles)).toBe(true);
  });
});

describe("walk mode (auto layout)", () => {
  it("starts in the hallway of a generated flat", () => {
    const plan = autoLayout([
      { name: "Salon", kind: "salon", area: 20 },
      { name: "Sypialnia", kind: "sypialnia", area: 12 },
      { name: "Łazienka", kind: "lazienka", area: 5 },
      { name: "Przedpokój", kind: "przedpokoj", area: 6 },
    ]);
    const s = walkStart(plan);
    expect(collides(s.x, s.z, buildObstacles(plan))).toBe(false);
    expect(roomAt(plan, s.x, s.z)?.kind).toBe("przedpokoj");
  });
});

describe("findPath", () => {
  it("walks around walls from the entrance into the bedroom (its centre is on the bed)", () => {
    const s = walkStart(PODGORZE_PLAN);
    const bed = PODGORZE_PLAN.rooms.find((r) => r.id === "syp")!;
    const path = findPath(PODGORZE_PLAN, s, { x: bed.c[0], z: bed.c[1] });
    expect(path.length).toBeGreaterThan(1);
    let p = { x: s.x, z: s.z };
    for (const wp of path) p = walk(p, wp);
    expect(roomAt(PODGORZE_PLAN, p.x, p.z)?.id).toBe("syp");
  });

  it("reaches every room of the sample flat from the entrance (the small furnished balcony: its door)", () => {
    const s = walkStart(PODGORZE_PLAN);
    for (const room of PODGORZE_PLAN.rooms) {
      const path = findPath(PODGORZE_PLAN, s, { x: room.c[0], z: room.c[1] });
      let p = { x: s.x, z: s.z };
      for (const wp of path) p = walk(p, wp);
      if (room.extra) {
        const [x0, x1, z0, z1] = room.rects[0];
        const gap = Math.hypot(Math.max(x0 - p.x, 0, p.x - x1), Math.max(z0 - p.z, 0, p.z - z1));
        expect(gap, room.name).toBeLessThan(0.8);
      } else {
        expect(roomAt(PODGORZE_PLAN, p.x, p.z)?.id, room.name).toBe(room.id);
      }
    }
  });
});
