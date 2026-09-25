import * as THREE from "three";
import type { FurnitureItem, Plan, Rect, Wall } from "@/lib/plan/types";

/*
 * Architectural details generated from the plan, for a more realistic walk:
 * skirting boards, door casings, window frames and sills, ceiling lights and
 * framed pictures. Everything is derived from walls/openings, so it works for
 * the sample flat and for flats laid out automatically from room areas.
 */

export type DetailMaterials = {
  trim: THREE.Material;
  frame: THREE.Material;
  sill: THREE.Material;
  shade: THREE.Material;
  dark: THREE.Material;
};

type Opening = Wall["op"][number];

function box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, m: THREE.Material, parent: THREE.Object3D, shadow = true) {
  if (x1 - x0 < 0.002 || y1 - y0 < 0.002 || z1 - z0 < 0.002) return;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), m);
  mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
}

/** Box along a wall: `a..b` along the wall axis, `n0..n1` across it (absolute coordinates). */
function along(w: Wall, a: number, b: number, y0: number, y1: number, n0: number, n1: number, m: THREE.Material, parent: THREE.Object3D, shadow = true) {
  if (w.ax === "x") box(a, b, y0, y1, n0, n1, m, parent, shadow);
  else box(n0, n1, y0, y1, a, b, m, parent, shadow);
}

const isDoorway = (o: Opening) => o.y0 < 0.1;

/** Sides of the wall facing a room: +1 / −1 along the wall normal (exterior walls: inside only). */
function roomSides(w: Wall, plan: Plan): number[] {
  if (w.t < 0.15) return [-1, 1];
  const [bx0, bx1, bz0, bz1] = plan.bounds;
  const centre = w.ax === "x" ? (bz0 + bz1) / 2 : (bx0 + bx1) / 2;
  return [Math.sign(centre - w.c) || 1];
}

function solidIntervals(w: Wall, skip: (o: Opening) => boolean): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let cur = w.a;
  for (const o of [...w.op].sort((p, q) => p.a - q.a)) {
    if (!skip(o)) continue;
    if (o.a - cur > 0.02) out.push([cur, o.a]);
    cur = o.b;
  }
  if (w.b - cur > 0.02) out.push([cur, w.b]);
  return out;
}

function artTexture(seed: number): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 384;
  const g = c.getContext("2d")!;
  let s = seed * 9301 + 49297;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const palettes = [
    ["#e9e2d4", "#c8a27c", "#7f9a86", "#3c4440"],
    ["#efe7dc", "#d8b4a0", "#9fb0c3", "#51606f"],
    ["#f1ece2", "#b9c6ae", "#d9a441", "#4a5a4f"],
  ];
  const p = palettes[seed % palettes.length];
  g.fillStyle = p[0];
  g.fillRect(0, 0, 512, 384);
  for (let i = 0; i < 5; i++) {
    g.globalAlpha = 0.55 + r() * 0.35;
    g.fillStyle = p[1 + Math.floor(r() * 3)];
    g.beginPath();
    if (r() > 0.5) g.ellipse(80 + r() * 350, 60 + r() * 260, 40 + r() * 120, 40 + r() * 100, 0, 0, Math.PI * 2);
    else g.rect(r() * 380, r() * 280, 60 + r() * 200, 30 + r() * 140);
    g.fill();
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const ART_ROOMS = new Set(["salon", "sypialnia", "pokoj", "dzieciecy", "gabinet"]);
const TALL = new Set<FurnitureItem["kind"]>(["wardrobe", "kitchen", "shelf", "tvUnit"]);

function overlaps(a: Rect, b: Rect) {
  return Math.min(a[1], b[1]) > Math.max(a[0], b[0]) && Math.min(a[3], b[3]) > Math.max(a[2], b[2]);
}

/**
 * @returns trims: casings, frames, sills and art (hidden in the cut-away view),
 *          skirting: skirting boards (always visible),
 *          lights: ceiling lights (shown with the ceiling in walk mode).
 */
export function buildDetails(plan: Plan, m: DetailMaterials) {
  const trims = new THREE.Group();
  const skirting = new THREE.Group();
  const lights = new THREE.Group();

  for (const w of plan.walls) {
    const half = w.t / 2;
    // skirting boards: 8 cm high, on every room-facing side, interrupted by doorways
    for (const side of roomSides(w, plan)) {
      const face = w.c + side * half;
      for (const [a, b] of solidIntervals(w, isDoorway)) {
        along(w, a, b, 0, 0.08, Math.min(face, face + side * 0.014), Math.max(face, face + side * 0.014), m.trim, skirting, false);
      }
    }
    for (const o of w.op) {
      const top = o.y1;
      if (o.glass) {
        // window / balcony door frame (in the wall plane) + mullion + inner sill
        const f = 0.055;
        const n0 = w.c - 0.05;
        const n1 = w.c + 0.05;
        along(w, o.a, o.a + f, o.y0, top, n0, n1, m.frame, trims);
        along(w, o.b - f, o.b, o.y0, top, n0, n1, m.frame, trims);
        along(w, o.a, o.b, top - f, top, n0, n1, m.frame, trims);
        along(w, o.a, o.b, o.y0, o.y0 + f, n0, n1, m.frame, trims);
        if (o.b - o.a > 1.1) along(w, (o.a + o.b) / 2 - f / 2, (o.a + o.b) / 2 + f / 2, o.y0, top, n0, n1, m.frame, trims);
        if (o.y0 > 0.1) {
          for (const side of roomSides(w, plan)) {
            const face = w.c + side * half;
            along(w, o.a - 0.05, o.b + 0.05, o.y0 - 0.03, o.y0, Math.min(face, face + side * 0.2), Math.max(face, face + side * 0.2), m.sill, trims);
          }
        }
      } else if (isDoorway(o)) {
        // door casing: two jambs and a head, 7 cm wide, proud of the wall by 1.5 cm
        const c = 0.07;
        const n0 = w.c - half - 0.015;
        const n1 = w.c + half + 0.015;
        along(w, o.a - c, o.a, 0, top + c, n0, n1, m.trim, trims);
        along(w, o.b, o.b + c, 0, top + c, n0, n1, m.trim, trims);
        along(w, o.a - c, o.b + c, top, top + c, n0, n1, m.trim, trims);
        if (o.door) {
          // handle on the entrance door
          for (const side of roomSides(w, plan)) {
            const face = w.c + side * (half * 0.35 + 0.04);
            along(w, o.b - 0.14, o.b - 0.02, 1.02, 1.05, Math.min(face, face + side * 0.03), Math.max(face, face + side * 0.03), m.dark, trims);
          }
        }
      }
    }
  }

  // ceiling lights: a flush disc in the middle of every room
  for (const r of plan.rooms) {
    if (r.extra) continue;
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.05, 32), m.shade);
    disc.position.set(r.c[0], 2.67, r.c[1]);
    lights.add(disc);
  }

  // framed pictures on a free wall of the living room and bedrooms
  let seed = 1;
  for (const room of plan.rooms) {
    if (!ART_ROOMS.has(room.kind)) continue;
    const [x0, x1, z0, z1] = room.rects[0];
    const edges = [
      { ax: "x" as const, c: z0, from: x0, to: x1, inward: 1 },
      { ax: "x" as const, c: z1, from: x0, to: x1, inward: -1 },
      { ax: "z" as const, c: x0, from: z0, to: z1, inward: 1 },
      { ax: "z" as const, c: x1, from: z0, to: z1, inward: -1 },
    ];
    let best: { w: Wall; a: number; b: number; inward: number } | null = null;
    for (const e of edges) {
      for (const w of plan.walls) {
        if (w.ax !== e.ax || Math.abs(w.c - e.c) > 0.08) continue;
        for (const [ia, ib] of solidIntervals(w, () => true)) {
          const a = Math.max(ia, e.from + 0.3);
          const b = Math.min(ib, e.to - 0.3);
          if (b - a < 1.3) continue;
          const face = w.c + e.inward * (w.t / 2);
          const band: Rect = w.ax === "x" ? [a, b, Math.min(face, face + e.inward * 0.8), Math.max(face, face + e.inward * 0.8)] : [Math.min(face, face + e.inward * 0.8), Math.max(face, face + e.inward * 0.8), a, b];
          if (plan.furniture.some((f) => TALL.has(f.kind) && overlaps(f.r, band))) continue;
          if (!best || b - a > best.b - best.a) best = { w, a, b, inward: e.inward };
        }
      }
    }
    if (!best) continue;
    const { w, a, b, inward } = best;
    const width = room.kind === "salon" ? 1.2 : 0.9;
    const height = room.kind === "salon" ? 0.75 : 0.6;
    const mid = (a + b) / 2;
    const face = w.c + inward * (w.t / 2);
    const art = new THREE.Group();
    // thin black frame and the canvas, 1.5–3 cm off the wall
    along(w, mid - width / 2 - 0.03, mid + width / 2 + 0.03, 1.55 - height / 2 - 0.03, 1.55 + height / 2 + 0.03, Math.min(face, face + inward * 0.025), Math.max(face, face + inward * 0.025), m.dark, art);
    const canvas = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ map: artTexture(seed++), roughness: 0.9 }));
    const off = face + inward * 0.027;
    if (w.ax === "x") {
      canvas.position.set(mid, 1.55, off);
      canvas.rotation.y = inward > 0 ? 0 : Math.PI;
    } else {
      canvas.position.set(off, 1.55, mid);
      canvas.rotation.y = inward > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    art.add(canvas);
    trims.add(art);
  }

  return { trims, skirting, lights };
}
