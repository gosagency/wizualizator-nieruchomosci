import type { FurnitureItem, Plan, Rect, Room, Wall } from "./types";

/*
 * Walk-mode geometry (first-person tour): obstacles from walls and furniture,
 * sliding collision for a round "visitor", the room at a point and a start pose.
 * Pure functions, so they are unit-tested without three.js.
 */

export const EYE_HEIGHT = 1.6;
export const VISITOR_RADIUS = 0.15;

/** Openings a visitor can walk through: doorways and the glass balcony door (not windows, not the entrance door). */
function passable(o: Wall["op"][number]) {
  return o.y0 < 0.1 && !o.door;
}

function wallObstacles(w: Wall): Rect[] {
  const out: Rect[] = [];
  const h = w.t / 2;
  let cur = w.a;
  const push = (a: number, b: number) => {
    if (b - a < 0.01) return;
    out.push(w.ax === "x" ? [a, b, w.c - h, w.c + h] : [w.c - h, w.c + h, a, b]);
  };
  for (const o of [...w.op].sort((p, q) => p.a - q.a)) {
    if (passable(o)) {
      push(cur, o.a);
      cur = o.b;
    }
  }
  push(cur, w.b);
  return out;
}

const WALK_OVER = new Set<FurnitureItem["kind"]>(["rug"]);
const CHAIR = 0.21;

/**
 * Chairs are drawn next to dining tables and desks (buildFurniture in
 * apartmentScene.ts) but are not part of the footprint, so they are added here.
 * Positions are in the canonical frame of the item: width along X, front towards +Z.
 */
function chairObstacles(f: FurnitureItem): Rect[] {
  const [x0, x1, z0, z1] = f.r;
  const face = f.face ?? "s";
  const sideways = face === "e" || face === "w";
  const W = sideways ? z1 - z0 : x1 - x0;
  const D = sideways ? x1 - x0 : z1 - z0;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const local: Array<[number, number]> = [];
  if (f.kind === "diningTable") {
    for (const x of W > 1.2 ? [-W / 4, W / 4] : [0]) local.push([x, -(D / 2 + 0.35)], [x, D / 2 + 0.35]);
  } else if (f.kind === "desk") {
    local.push([0, D / 2 + 0.35]);
  }
  return local.map(([lx, lz]) => {
    const [wx, wz] = { s: [lx, lz], n: [-lx, -lz], e: [lz, -lx], w: [-lz, lx] }[face];
    return [cx + wx - CHAIR, cx + wx + CHAIR, cz + wz - CHAIR, cz + wz + CHAIR];
  });
}

export function buildObstacles(plan: Plan): Rect[] {
  const rects: Rect[] = plan.walls.flatMap(wallObstacles);
  for (const f of plan.furniture) {
    if (WALK_OVER.has(f.kind)) continue;
    rects.push(f.r, ...chairObstacles(f));
  }
  if (plan.balcony) {
    const [x0, x1, z0, z1] = plan.balcony.rect;
    const t = 0.05;
    const a = plan.balcony.attach;
    if (a !== "n") rects.push([x0, x1, z0 - t, z0 + t]);
    if (a !== "s") rects.push([x0, x1, z1 - t, z1 + t]);
    if (a !== "w") rects.push([x0 - t, x0 + t, z0, z1]);
    if (a !== "e") rects.push([x1 - t, x1 + t, z0, z1]);
  }
  return rects;
}

function hits(x: number, z: number, r: number, [x0, x1, z0, z1]: Rect) {
  const dx = x - Math.max(x0, Math.min(x, x1));
  const dz = z - Math.max(z0, Math.min(z, z1));
  return dx * dx + dz * dz < r * r;
}

export function collides(x: number, z: number, obstacles: Rect[], r = VISITOR_RADIUS) {
  return obstacles.some((o) => hits(x, z, r, o));
}

/** Moves by (dx, dz), sliding along obstacles axis by axis. */
export function moveWithCollisions(x: number, z: number, dx: number, dz: number, obstacles: Rect[], r = VISITOR_RADIUS) {
  let nx = x;
  let nz = z;
  if (!collides(x + dx, z, obstacles, r)) nx = x + dx;
  if (!collides(nx, z + dz, obstacles, r)) nz = z + dz;
  return { x: nx, z: nz, blocked: nx === x && nz === z && (dx !== 0 || dz !== 0) };
}

export function roomAt(plan: Plan, x: number, z: number): Room | undefined {
  return plan.rooms.find((room) => room.rects.some(([x0, x1, z0, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1));
}

/**
 * Start inside the entrance door, looking into the apartment.
 * yaw: rotation around Y, 0 = looking towards −Z (three.js camera convention).
 */
export function walkStart(plan: Plan): { x: number; z: number; yaw: number } {
  const [bx0, bx1, bz0, bz1] = plan.bounds;
  const cx = (bx0 + bx1) / 2;
  const cz = (bz0 + bz1) / 2;
  const obstacles = buildObstacles(plan);
  const yawTowards = (x: number, z: number, tx: number, tz: number) => Math.atan2(-(tx - x), -(tz - z));

  for (const w of plan.walls) {
    const door = w.op.find((o) => o.door);
    if (!door) continue;
    const along = (door.a + door.b) / 2;
    // step inside, away from the wall, towards the middle of the flat
    for (const step of [0.8, 1.1, 0.6, 1.4]) {
      const x = w.ax === "x" ? along : w.c + Math.sign(cx - w.c) * step;
      const z = w.ax === "x" ? w.c + Math.sign(cz - w.c) * step : along;
      if (!collides(x, z, obstacles)) {
        const inward = w.ax === "x" ? { x, z: z + Math.sign(cz - w.c) } : { x: x + Math.sign(cx - w.c), z };
        return { x, z, yaw: yawTowards(x, z, inward.x, inward.z) };
      }
    }
  }
  const room = plan.rooms.find((r) => r.kind === "przedpokoj") ?? plan.rooms.find((r) => !r.extra) ?? plan.rooms[0];
  return { x: room.c[0], z: room.c[1], yaw: yawTowards(room.c[0], room.c[1], cx, cz) };
}

type Pt = { x: number; z: number };

function lineClear(a: Pt, b: Pt, obstacles: Rect[], r: number) {
  const d = Math.hypot(b.x - a.x, b.z - a.z);
  const n = Math.max(1, Math.ceil(d / 0.05));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    if (collides(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, obstacles, r)) return false;
  }
  return true;
}

/**
 * Walkable route from `from` towards `to`: breadth-first search on a 10 cm grid over
 * the cells reachable from `from`, ending at the reachable cell closest to `to`
 * (so a target on a bed or behind a wall still gives a sensible walk), then
 * shortened to its corners by line of sight. Returns [] if already there.
 */
export function findPath(plan: Plan, from: Pt, to: Pt, obstacles = buildObstacles(plan), r = VISITOR_RADIUS): Pt[] {
  const cell = 0.1;
  const all = plan.rooms.flatMap((room) => room.rects).concat([plan.bounds]);
  const x0 = Math.min(...all.map((q) => q[0])) - 0.5;
  const z0 = Math.min(...all.map((q) => q[2])) - 0.5;
  const w = Math.ceil((Math.max(...all.map((q) => q[1])) + 0.5 - x0) / cell);
  const h = Math.ceil((Math.max(...all.map((q) => q[3])) + 0.5 - z0) / cell);
  const cx = (i: number) => x0 + (i + 0.5) * cell;
  const cz = (j: number) => z0 + (j + 0.5) * cell;
  const free = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) free[j * w + i] = collides(cx(i), cz(j), obstacles, r) ? 0 : 1;

  const clampI = (x: number) => Math.max(0, Math.min(w - 1, Math.floor((x - x0) / cell)));
  const clampJ = (z: number) => Math.max(0, Math.min(h - 1, Math.floor((z - z0) / cell)));
  let s = clampJ(from.z) * w + clampI(from.x);
  if (!free[s]) {
    // start slightly inside an obstacle (e.g. after a teleport): use the nearest free neighbour
    let best = -1;
    let bestD = Infinity;
    for (let k = 0; k < w * h; k++) {
      if (!free[k]) continue;
      const d = Math.hypot(cx(k % w) - from.x, cz(Math.floor(k / w)) - from.z);
      if (d < bestD) [best, bestD] = [k, d];
    }
    if (best < 0) return [];
    s = best;
  }

  // BFS over free cells (8-connected, no corner cutting)
  const prev = new Int32Array(w * h).fill(-2);
  prev[s] = -1;
  const queue = [s];
  let goal = s;
  let goalD = Math.hypot(cx(s % w) - to.x, cz(Math.floor(s / w)) - to.z);
  for (let qi = 0; qi < queue.length; qi++) {
    const k = queue[qi];
    const i = k % w;
    const j = Math.floor(k / w);
    const d = Math.hypot(cx(i) - to.x, cz(j) - to.z);
    if (d < goalD) [goal, goalD] = [k, d];
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = i + di;
        const nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue;
        const n = nj * w + ni;
        if (prev[n] !== -2 || !free[n]) continue;
        if (di && dj && (!free[j * w + ni] || !free[nj * w + i])) continue;
        prev[n] = k;
        queue.push(n);
      }
  }
  if (goal === s) return [];

  const cells: Pt[] = [];
  for (let k = goal; k !== -1; k = prev[k]) cells.push({ x: cx(k % w), z: cz(Math.floor(k / w)) });
  cells.reverse();
  cells[0] = { ...from };
  if (goalD < cell && !collides(to.x, to.z, obstacles, r)) cells[cells.length - 1] = { ...to };

  // keep only the corners: skip points while the straight line stays clear
  const out: Pt[] = [cells[0]];
  let anchor = 0;
  for (let i = 2; i < cells.length; i++) {
    if (!lineClear(cells[anchor], cells[i], obstacles, r)) {
      out.push(cells[i - 1]);
      anchor = i - 1;
    }
  }
  out.push(cells[cells.length - 1]);
  return out.slice(1);
}
