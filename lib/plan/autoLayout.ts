import { round1 } from "./area";
import {
  floorFor,
  type Balcony,
  type FurnitureItem,
  type Opening,
  type Plan,
  type Rect,
  type Room,
  type RoomKind,
  type Wall,
} from "./types";

export type RoomInput = {
  name: string;
  kind: RoomKind;
  area: number;
};

type Side = "n" | "s" | "e" | "w";

const SIDE_PL: Record<Side, string> = { n: "północ", s: "południe", e: "wschód", w: "zachód" };

const EXT = 0.2;
const INT = 0.1;
const DOOR_W = 0.9;
const WIN_Y0 = 0.85;
const WIN_Y1 = 2.3;
const DOOR_Y1 = 2.05;
/** Rooms smaller than this go to the west end of the corridor (e.g. WC). */
const SMALL_ROOM = 3.5;

type Placed = {
  input: RoomInput;
  id: string;
  rect: Rect;
  row: "top" | "bottom" | "hall" | "cap";
};

/**
 * Builds a plausible floor plan from a list of rooms and their areas.
 *
 * Layout: rooms in two rows (north and south) along a corridor (przedpokój),
 * entrance at the east end of the corridor, balcony off the living room.
 * Every room keeps its exact area. The result is an approximation for the
 * 3D preview, not a survey drawing (PRD, section 7).
 */
export function autoLayout(inputs: RoomInput[]): Plan {
  const rooms = inputs.filter((r) => r.area > 0);
  const balconyIn = rooms.find((r) => r.kind === "balkon");
  const hallIn = rooms.find((r) => r.kind === "przedpokoj");
  const rest = rooms.filter((r) => r !== balconyIn && r !== hallIn);

  // One small room (WC) sits at the corridor's west end instead of in a row.
  const capIn = rest.find((r) => r.area < SMALL_ROOM);
  const rowRooms = rest.filter((r) => r !== capIn);

  // Balance two rows by area; the living room always goes north (balcony side).
  const top: RoomInput[] = [];
  const bottom: RoomInput[] = [];
  const sorted = [...rowRooms].sort((a, b) => rank(a) - rank(b) || b.area - a.area);
  let aTop = 0;
  let aBottom = 0;
  for (const r of sorted) {
    const forceTop = r.kind === "salon" && !top.some((t) => t.kind === "salon");
    if (forceTop || aTop <= aBottom) {
      top.push(r);
      aTop += r.area;
    } else {
      bottom.push(r);
      aBottom += r.area;
    }
  }
  if (bottom.length === 0 && top.length > 1) {
    const moved = top.pop()!;
    bottom.push(moved);
    aTop -= moved.area;
    aBottom += moved.area;
  }

  const hallArea = hallIn?.area ?? 0;
  const bandArea = hallArea + (capIn?.area ?? 0);
  const total = aTop + aBottom + bandArea;

  // Building length: aim for a 1.5 : 1 footprint, then keep the corridor 1.1–2.0 m wide.
  let L = Math.sqrt(1.5 * total);
  if (bandArea > 0) {
    L = Math.min(L, bandArea / 1.1);
    L = Math.max(L, bandArea / 2.0);
  }
  // Rows must not get too shallow either.
  const minRow = Math.min(aTop, aBottom);
  if (minRow > 0 && minRow / L < 2.4) L = Math.max(minRow / 2.4, bandArea / 2.2);

  const dTop = aTop / L;
  const wBand = bandArea / L;
  const dBottom = aBottom / L;
  const zBand0 = dTop;
  const zBand1 = dTop + wBand;
  const D = zBand1 + dBottom;

  const placed: Placed[] = [];
  const ids = new Map<string, number>();
  const makeId = (kind: RoomKind) => {
    const n = (ids.get(kind) ?? 0) + 1;
    ids.set(kind, n);
    return n === 1 ? kind : `${kind}${n}`;
  };

  // Top row: living room first (west); bottom row: bathroom last (east, near the entrance).
  const topOrdered = [...top].sort((a, b) => (a.kind === "salon" ? -1 : b.kind === "salon" ? 1 : 0));
  const bottomOrdered = [...bottom].sort((a, b) => (a.kind === "lazienka" ? 1 : b.kind === "lazienka" ? -1 : 0));

  let x = 0;
  for (const r of topOrdered) {
    const w = r.area / dTop;
    placed.push({ input: r, id: makeId(r.kind), rect: [x, x + w, 0, dTop], row: "top" });
    x += w;
  }
  x = 0;
  for (const r of bottomOrdered) {
    const w = r.area / dBottom;
    placed.push({ input: r, id: makeId(r.kind), rect: [x, x + w, zBand1, D], row: "bottom" });
    x += w;
  }
  let hallX0 = 0;
  if (capIn && wBand > 0) {
    const w = capIn.area / wBand;
    placed.push({ input: capIn, id: makeId(capIn.kind), rect: [0, w, zBand0, zBand1], row: "cap" });
    hallX0 = w;
  }
  if (hallIn && wBand > 0) {
    placed.push({ input: hallIn, id: makeId("przedpokoj"), rect: [hallX0, L, zBand0, zBand1], row: "hall" });
  }

  // ---------- balcony ----------
  const salon = placed.find((p) => p.input.kind === "salon") ?? placed.find((p) => p.row === "top");
  let balcony: Balcony | undefined;
  let balconyRect: Rect | undefined;
  if (balconyIn && salon) {
    const sw = salon.rect[1] - salon.rect[0];
    let depth = 1.4;
    let width = balconyIn.area / depth;
    const maxW = Math.max(1.4, sw - 0.4);
    if (width > maxW) {
      width = maxW;
      depth = Math.min(2.2, balconyIn.area / width);
    }
    const bx0 = salon.rect[0] + Math.max(0.2, (sw - width) / 2);
    balconyRect = [bx0, bx0 + width, -0.1 - depth, -0.1];
    balcony = { rect: balconyRect, attach: "s" };
  }

  // ---------- walls ----------
  const windows = new Map<string, Side[]>();
  const addWin = (id: string, s: Side) => windows.set(id, [...(windows.get(id) ?? []), s]);

  const north: Wall = { ax: "x", c: 0, a: -0.1, b: L + 0.1, t: EXT, op: [] };
  const south: Wall = { ax: "x", c: D, a: -0.1, b: L + 0.1, t: EXT, op: [] };
  const west: Wall = { ax: "z", c: 0, a: 0.1, b: D - 0.1, t: EXT, op: [] };
  const east: Wall = { ax: "z", c: L, a: 0.1, b: D - 0.1, t: EXT, op: [] };

  for (const p of placed) {
    const [x0, x1, z0, z1] = p.rect;
    const kind = p.input.kind;
    const wantsWindow = kind !== "przedpokoj" && kind !== "wc";
    if (p.row === "top" || p.row === "bottom") {
      const wall = p.row === "top" ? north : south;
      if (p === salon && balconyRect) {
        const door = centered(balconyRect[0], balconyRect[1], Math.min(1.0, balconyRect[1] - balconyRect[0] - 0.2));
        wall.op.push({ ...door, y0: 0, y1: WIN_Y1, glass: true });
        const free = x1 - door.b;
        if (free > 1.6) wall.op.push({ ...centered(door.b, x1, Math.min(1.5, free - 0.8)), y0: WIN_Y0, y1: WIN_Y1, glass: true });
      } else if (wantsWindow) {
        const small = kind === "lazienka";
        const ww = small ? Math.min(0.7, (x1 - x0) * 0.4) : Math.min(1.5, (x1 - x0) * 0.5);
        wall.op.push({ ...centered(x0, x1, ww), y0: small ? 1.5 : WIN_Y0, y1: small ? 2.1 : WIN_Y1, glass: true });
      }
      addWin(p.id, p.row === "top" ? "n" : "s");
      // Corner rooms get a second window on the gable wall.
      if (wantsWindow && kind !== "lazienka") {
        if (x0 < 0.01) {
          west.op.push({ ...centered(z0, z1, Math.min(1.4, (z1 - z0) * 0.45)), y0: WIN_Y0, y1: WIN_Y1, glass: true });
          addWin(p.id, "w");
        }
        if (x1 > L - 0.01) {
          east.op.push({ ...centered(z0, z1, Math.min(1.4, (z1 - z0) * 0.45)), y0: WIN_Y0, y1: WIN_Y1, glass: true });
          addWin(p.id, "e");
        }
      }
    }
  }
  if (wBand > 0) {
    const d = centered(zBand0, zBand1, Math.min(DOOR_W, wBand - 0.2));
    east.op.push({ ...d, y0: 0, y1: 2.1, door: true });
  }

  const walls: Wall[] = [north, south, west, east];

  // Corridor walls with one doorway per room.
  const bandWall = (z: number, row: "top" | "bottom"): Wall => {
    const op: Opening[] = [];
    for (const p of placed.filter((q) => q.row === row)) {
      const [x0, x1] = p.rect;
      const lo = Math.max(x0, hallX0);
      if (x1 - lo < 0.8) continue;
      const wide = p.input.kind === "salon";
      const w = wide ? Math.min(1.4, x1 - lo - 0.3) : Math.min(DOOR_W, x1 - lo - 0.3);
      const a = Math.min(lo + 0.25, x1 - w - 0.15);
      op.push({ a, b: a + w, y0: 0, y1: DOOR_Y1 });
    }
    return { ax: "x", c: z, a: 0.1, b: L - 0.1, t: INT, op };
  };
  if (wBand > 0) {
    walls.push(bandWall(zBand0, "top"), bandWall(zBand1, "bottom"));
  }
  // Partitions between neighbours in a row.
  for (const row of ["top", "bottom"] as const) {
    const rowRooms = placed.filter((p) => p.row === row);
    for (let i = 1; i < rowRooms.length; i++) {
      const [x0, , z0, z1] = rowRooms[i].rect;
      walls.push({ ax: "z", c: x0, a: z0 + 0.1, b: z1 - 0.05, t: INT, op: [] });
    }
  }
  // WC at the corridor end.
  const cap = placed.find((p) => p.row === "cap");
  if (cap) {
    const d = centered(zBand0, zBand1, Math.min(0.8, wBand - 0.2));
    walls.push({ ax: "z", c: cap.rect[1], a: zBand0 + 0.05, b: zBand1 - 0.05, t: INT, op: [{ ...d, y0: 0, y1: DOOR_Y1 }] });
  }

  // ---------- rooms (in the order the agent entered them) ----------
  const outRooms: Room[] = [...placed].sort((a, b) => inputs.indexOf(a.input) - inputs.indexOf(b.input)).map((p) => {
    const [x0, x1, z0, z1] = p.rect;
    return {
      id: p.id,
      name: p.input.name,
      kind: p.input.kind,
      area: p.input.area,
      rects: [p.rect],
      c: [round2((x0 + x1) / 2), round2((z0 + z1) / 2)],
      floor: floorFor(p.input.kind),
      features: featuresFor(p, windows.get(p.id) ?? [], !!balconyRect && p === salon),
    };
  });
  if (balconyIn && balconyRect) {
    outRooms.push({
      id: "balkon",
      name: balconyIn.name,
      kind: "balkon",
      area: balconyIn.area,
      rects: [balconyRect],
      c: [round2((balconyRect[0] + balconyRect[1]) / 2), round2((balconyRect[2] + balconyRect[3]) / 2)],
      floor: "deck",
      extra: true,
      features: ["Wyjście z salonu", "Poza metrażem mieszkania"],
    });
  }

  // ---------- furniture ----------
  const hasKitchen = placed.some((p) => p.input.kind === "kuchnia");
  const furniture: FurnitureItem[] = [];
  for (const p of placed) furniture.push(...furnish(p, hasKitchen));
  if (balconyRect) {
    const [bx0, bx1, bz0, bz1] = balconyRect;
    const cx = (bx0 + bx1) / 2;
    const cz = (bz0 + bz1) / 2;
    furniture.push({ kind: "outdoorSet", r: [cx - 0.5, cx + 0.5, cz - 0.45, cz + 0.45] });
    furniture.push({ kind: "plant", r: [bx0 + 0.1, bx0 + 0.4, bz0 + 0.1, bz0 + 0.4], h: 0.26 });
  }

  return {
    bounds: [-0.1, round2(L + 0.1), -0.1, round2(D + 0.1)],
    rooms: outRooms,
    walls: walls.map(roundWall),
    balcony,
    furniture,
    sunFrom: "n",
  };
}

function rank(r: RoomInput): number {
  const order: RoomKind[] = ["salon", "kuchnia", "sypialnia", "pokoj", "dzieciecy", "gabinet", "lazienka", "wc"];
  const i = order.indexOf(r.kind);
  return i === -1 ? order.length : i;
}

function centered(a: number, b: number, w: number) {
  const m = (a + b) / 2;
  return { a: m - w / 2, b: m + w / 2 };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function roundWall(w: Wall): Wall {
  return {
    ...w,
    c: round2(w.c),
    a: round2(w.a),
    b: round2(w.b),
    op: w.op.map((o) => ({ ...o, a: round2(o.a), b: round2(o.b) })),
  };
}

function featuresFor(p: Placed, sides: Side[], hasBalcony: boolean): string[] {
  const f: string[] = [];
  const unique = [...new Set(sides)];
  if (p.input.kind === "przedpokoj") f.push("Wejście do mieszkania", "Miejsce na szafę");
  else if (unique.length === 1) f.push(`Okno na ${SIDE_PL[unique[0]]}`);
  else if (unique.length > 1) f.push(`Okna: ${unique.map((s) => SIDE_PL[s]).join(" i ")}`);
  if (hasBalcony) f.push("Wyjście na balkon");
  const [x0, x1, z0, z1] = p.rect;
  f.push(`Wymiary ok. ${round1(x1 - x0).toLocaleString("pl-PL")} × ${round1(z1 - z0).toLocaleString("pl-PL")} m`);
  return f;
}

/**
 * Furniture in a room-local frame: u runs west→east from the room's west wall,
 * v runs from the exterior (window) wall towards the corridor. Doorways sit at
 * the west end of the corridor wall, so the zone u < 1.4, v > d − 1.2 stays free.
 */
function furnish(p: Placed, hasKitchen: boolean): FurnitureItem[] {
  const [x0, x1, z0, z1] = p.rect;
  const w = x1 - x0;
  const d = z1 - z0;
  const out: FurnitureItem[] = [];
  const top = p.row === "top";

  if (p.row === "hall" || p.row === "cap") {
    if (p.input.kind === "przedpokoj") {
      const len = Math.min(2.0, w * 0.3);
      if (d > 1.3) out.push({ kind: "wardrobe", r: [x1 - 0.3 - len, x1 - 0.3, z1 - 0.62, z1 - 0.02], face: "n" });
      out.push({ kind: "rug", r: [x0 + w * 0.3, x0 + w * 0.7, z0 + d * 0.3, z1 - d * 0.3] });
    } else {
      out.push({ kind: "toilet", r: [x0 + 0.05, x0 + 0.6, (z0 + z1) / 2 - 0.2, (z0 + z1) / 2 + 0.2], face: "e" });
    }
    return out;
  }

  const put = (kind: FurnitureItem["kind"], u0: number, u1: number, v0: number, v1: number, face?: "in" | "out" | "left" | "right", h?: number) => {
    const cu0 = Math.max(0.05, Math.min(u0, u1));
    const cu1 = Math.min(w - 0.05, Math.max(u0, u1));
    const cv0 = Math.max(0.05, Math.min(v0, v1));
    const cv1 = Math.min(d - 0.05, Math.max(v0, v1));
    if (cu1 - cu0 < 0.2 || cv1 - cv0 < 0.2) return;
    const zA = top ? z0 + cv0 : z1 - cv1;
    const zB = top ? z0 + cv1 : z1 - cv0;
    const faceMap = { in: top ? "s" : "n", out: top ? "n" : "s", left: "w", right: "e" } as const;
    out.push({ kind, r: [x0 + cu0, x0 + cu1, zA, zB], face: face ? faceMap[face] : undefined, h });
  };

  switch (p.input.kind) {
    case "salon": {
      const sofaL = Math.min(2.4, w * 0.45);
      const su1 = w - 0.3;
      const su0 = su1 - sofaL;
      put("rug", su0, su1, d * 0.3, d - 1.0);
      put("sofa", su0, su1, d - 0.95, d - 0.1, "out");
      put("coffeeTable", su0 + sofaL * 0.3, su1 - sofaL * 0.3, d - 1.85, d - 1.3);
      put("tvUnit", su0 + 0.2, su1 - 0.2, 0.1, 0.5, "in");
      put("floorLamp", w - 0.4, w - 0.1, d - 0.4, d - 0.1);
      if (!hasKitchen) {
        put("kitchen", 0.05, 0.65, 0.1, Math.min(2.8, d - 1.4), "right");
        if (su0 > 2.2) put("diningTable", 1.0, Math.min(2.4, su0 - 0.5), d * 0.35, d * 0.35 + 0.8);
      } else if (su0 > 1.8) {
        put("plant", 0.2, 0.5, 0.2, 0.5);
      }
      put("plant", 0.15, 0.45, d - 1.6, d - 1.3, undefined, 0.3);
      break;
    }
    case "kuchnia": {
      put("kitchen", 0.05, 0.65, 0.1, d - 1.3, "right");
      put("kitchen", 0.65, w - 0.3, 0.05, 0.65, "in");
      if (w > 2.6 && d > 2.8) put("diningTable", w - 1.6, w - 0.4, d - 1.9, d - 1.2);
      break;
    }
    case "sypialnia": {
      const bedW = Math.min(1.6, d - 1.6);
      const bv0 = Math.max(0.6, d * 0.42 - bedW / 2);
      put("bed", w - 2.05, w - 0.05, bv0, bv0 + bedW, "left");
      put("nightstand", w - 0.5, w - 0.05, bv0 - 0.5, bv0 - 0.05);
      put("nightstand", w - 0.5, w - 0.05, bv0 + bedW + 0.05, bv0 + bedW + 0.5);
      put("rug", w - 2.6, w - 1.0, bv0 - 0.3, bv0 + bedW + 0.3);
      if (w > 3.2) put("wardrobe", 0.05, 0.65, 0.3, Math.min(2.5, d - 1.4), "right");
      put("plant", 0.15, 0.45, 0.1, 0.4);
      break;
    }
    case "pokoj":
    case "dzieciecy":
    case "gabinet": {
      if (p.input.kind !== "gabinet") put("singleBed", w - 0.95, w - 0.05, 0.3, 2.3, "left");
      put("desk", 0.3, Math.min(1.6, w - 1.2), 0.05, 0.65, "in");
      put("shelf", 0.05, 0.45, 1.0, Math.min(2.0, d - 1.4), "right");
      put("rug", w * 0.3, w * 0.75, d * 0.35, d * 0.7);
      if (p.input.kind === "gabinet") put("plant", w - 0.45, w - 0.15, 0.15, 0.45);
      break;
    }
    case "lazienka": {
      put("bathtub", 0.05, Math.min(1.7, w - 0.1), 0.05, 0.8);
      put("sink", w - 0.5, w - 0.05, 1.0, 1.9, "left");
      put("toilet", w - 0.6, w - 0.05, d - 1.0, d - 0.55, "left");
      break;
    }
    case "wc": {
      put("toilet", w / 2 - 0.2, w / 2 + 0.2, 0.05, 0.6, "in");
      break;
    }
    default:
      break;
  }
  return out;
}
