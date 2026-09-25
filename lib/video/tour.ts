"use client";

import * as THREE from "three";
import type { Offer, Org } from "@/lib/demo/types";
import { formatArea, formatPrice } from "@/lib/plan/area";
import { DAY_BG } from "@/components/model3d/apartmentScene";
import { drawBrandBar, drawCard, drawLowerThird, drawPreviewBadge, easeInOut, fade, loadImage, publicLinkText } from "./overlay";
import { recordCanvas, VIDEO_SIZE } from "./record";

type Format = keyof typeof VIDEO_SIZE;

type Segment = {
  start: number;
  end: number;
  from: { pos: THREE.Vector3; target: THREE.Vector3 };
  to: { pos: THREE.Vector3; target: THREE.Vector3 };
  /** time of the camera move inside the segment; the rest is a slow drift */
  move: number;
  roomId?: string;
  drift?: number;
};

const INTRO = 3800;
const ROOM_MOVE = 1100;
const ROOM_HOLD = 1800;
const OUTRO_MOVE = 1300;
const OUTRO_HOLD = 3200;

/**
 * "Spacer 3D": records a camera flight over the apartment model with room
 * captions and the office's branding. No AI provider needed.
 */
export async function recordTour(offer: Offer, org: Org, format: Format, onProgress?: (p: number) => void) {
  const { w: W, h: H } = VIDEO_SIZE[format];
  const portrait = format === "9:16";
  const s = portrait ? 1 : 1.05;

  // Off-screen host at the exact video size.
  const host = document.createElement("div");
  Object.assign(host.style, { position: "fixed", left: "-20000px", top: "0", width: `${W}px`, height: `${H}px` });
  document.body.appendChild(host);

  const { ApartmentScene } = await import("@/components/model3d/apartmentScene");
  const scene = new ApartmentScene(host, offer.plan, { pixelRatio: 1, autoStart: false });
  const logo = org.logo ? await loadImage(org.logo).catch(() => null) : null;

  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const g = out.getContext("2d")!;
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, DAY_BG[0]);
  bg.addColorStop(1, DAY_BG[1]);

  // ---------- camera script ----------
  const c = scene.center;
  const aspect = W / H;
  const vFov = THREE.MathUtils.degToRad(scene.camera.fov);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
  /** distance at which a sphere of radius r fills the frame */
  const fit = (r: number) => r / Math.sin(Math.min(vFov, hFov) / 2);
  const allRects = offer.plan.rooms.flatMap((r) => r.rects).concat([offer.plan.bounds]);
  const ext = {
    x0: Math.min(...allRects.map((q) => q[0])),
    x1: Math.max(...allRects.map((q) => q[1])),
    z0: Math.min(...allRects.map((q) => q[2])),
    z1: Math.max(...allRects.map((q) => q[3])),
  };
  const homeDir = scene.homePos.clone().sub(c).normalize();
  const radius = Math.hypot(ext.x1 - ext.x0, ext.z1 - ext.z0) / 2;
  const home = (angle: number) => {
    const off = homeDir.clone().multiplyScalar(fit(radius * 0.92)).applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    return { pos: c.clone().add(off), target: c.clone() };
  };
  const roomsInOrder = [...offer.plan.rooms].sort((a, b) => Number(!!a.extra) - Number(!!b.extra));
  const segments: Segment[] = [];
  let t = 0;
  segments.push({ start: 0, end: INTRO, from: home(-0.5), to: home(0.1), move: INTRO });
  t = INTRO;
  let prev = home(0.1);
  for (const r of roomsInOrder) {
    const p = scene.roomPose(r.id, prev.pos, prev.target);
    const rw = Math.max(...r.rects.map((q) => q[1])) - Math.min(...r.rects.map((q) => q[0]));
    const rd = Math.max(...r.rects.map((q) => q[3])) - Math.min(...r.rects.map((q) => q[2]));
    const dir = p.pos.clone().sub(p.target).normalize();
    p.pos.copy(p.target).addScaledVector(dir, fit(Math.hypot(rw, rd) / 2 + 0.8));
    segments.push({ start: t, end: t + ROOM_MOVE + ROOM_HOLD, from: prev, to: p, move: ROOM_MOVE, roomId: r.id, drift: 0.12 });
    t += ROOM_MOVE + ROOM_HOLD;
    prev = p;
  }
  const ec = new THREE.Vector3((ext.x0 + ext.x1) / 2, 0, (ext.z0 + ext.z1) / 2);
  // Portrait: turn the plan 90° so its long side runs along the screen height.
  const [spanScreenW, spanScreenH] = portrait ? [ext.z1 - ext.z0, ext.x1 - ext.x0] : [ext.x1 - ext.x0, ext.z1 - ext.z0];
  const topH = Math.max(spanScreenW / 2 / Math.tan(hFov / 2), spanScreenH / 2 / Math.tan(vFov / 2)) * 1.08 + 2.7;
  // Leave the lower part of the frame for the outro card.
  const topPose = portrait
    ? { pos: new THREE.Vector3(ec.x + 0.01, topH * 1.25, ec.z), target: ec.clone().add(new THREE.Vector3(0.9 * spanScreenH * 0.18, 0, 0)) }
    : { pos: new THREE.Vector3(ec.x, topH * 1.2, ec.z + 0.01), target: ec.clone().add(new THREE.Vector3(0, 0, 0.9 * spanScreenH * 0.12)) };
  segments.push({ start: t, end: t + OUTRO_MOVE + OUTRO_HOLD, from: prev, to: topPose, move: OUTRO_MOVE });
  const duration = t + OUTRO_MOVE + OUTRO_HOLD;

  const pos = new THREE.Vector3();
  const target = new THREE.Vector3();
  const axisY = new THREE.Vector3(0, 1, 0);
  let lastRoom: string | undefined = "__none";

  const rooms = offer.rooms.filter((r) => r.kind !== "balkon" && r.kind !== "przedpokoj" && r.kind !== "lazienka" && r.kind !== "wc").length;
  const introLines = [
    { text: `${offer.district ? offer.district + ", " : ""}${offer.city}`, size: 22, weight: 500, opacity: 0.85 },
    { text: offer.title, size: 40, weight: 700, gap: 14 },
    { text: formatPrice(offer.price), size: 34, weight: 700 },
    { text: `${formatArea(offer.area)} · ${rooms} ${rooms === 1 ? "pokój" : rooms < 5 ? "pokoje" : "pokoi"} · piętro ${offer.floor}`, size: 20, weight: 500, opacity: 0.85 },
  ];
  const outroLines = [
    { text: "Obejrzyj mieszkanie w 3D", size: 30, weight: 700, gap: 14 },
    { text: publicLinkText(offer.slug), size: 22, weight: 500, opacity: 0.9, gap: 18 },
    { text: offer.agent.name, size: 22, weight: 600 },
    { text: offer.agent.phone, size: 22, weight: 500, opacity: 0.85 },
  ];

  const draw = (time: number) => {
    const seg = segments.find((sg) => time <= sg.end) ?? segments[segments.length - 1];
    const local = time - seg.start;
    const k = easeInOut(Math.min(1, local / seg.move));
    pos.lerpVectors(seg.from.pos, seg.to.pos, k);
    target.lerpVectors(seg.from.target, seg.to.target, k);
    if (seg.drift && local > seg.move) {
      const d = ((local - seg.move) / (seg.end - seg.start - seg.move)) * seg.drift;
      pos.sub(target).applyAxisAngle(axisY, d).add(target);
    }
    if (seg.roomId !== lastRoom) {
      scene.highlight(seg.roomId ?? null);
      // Lowered walls (cutaway) once the camera goes into the rooms: furniture stays visible.
      if (time >= INTRO && !scene.isCutaway) scene.setCutaway(true);
      lastRoom = seg.roomId;
    }
    scene.renderPose(pos, target);

    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    g.drawImage(scene.canvas, 0, 0, W, H);
    drawBrandBar(g, W, s, org, logo);

    if (seg.roomId) {
      const room = offer.plan.rooms.find((r) => r.id === seg.roomId)!;
      const a = fade(local, ROOM_MOVE * 0.6, seg.end - seg.start, 300);
      drawLowerThird(g, W, H, s, org.color, room.name, `${formatArea(room.area)}${room.features[0] ? " · " + room.features[0] : ""}`, a);
    }
    drawCard(g, W, H, s, org.color, introLines, fade(time, 300, INTRO - 200, 400));
    const outroStart = duration - OUTRO_HOLD;
    drawCard(g, W, H, s, org.color, outroLines, fade(time, outroStart, duration + 400, 400), "bottom");
    drawPreviewBadge(g, W, H, s);
  };

  try {
    return await recordCanvas(out, duration, draw, onProgress);
  } finally {
    scene.dispose();
    host.remove();
  }
}
