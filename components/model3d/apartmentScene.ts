import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { buildDetails } from "./details";
import type { FurnitureItem, Plan, Rect, Room, Wall } from "@/lib/plan/types";
import { WalkController, type WalkInput } from "./walkController";

/*
 * Interactive 3D apartment built from a Plan (skill: model-3d-z-rzutu).
 * Port of docs/reference/demo-3d-podgorze.html to ES-module three.js.
 * Light intensities are ×π because three r155+ uses physical light units.
 */

const PI = Math.PI;
/** ?ao=1 keeps ambient occlusion on even on slow devices (for checking the look). */
const FORCE_AO = typeof location !== "undefined" && new URLSearchParams(location.search).get("ao") === "1";
const WALL_H = 2.7;
const CUT_H = 1.0;

export const DAY_BG = ["#e8edf1", "#f7f5f0"] as const;
export const EVENING_BG = ["#1b2231", "#3b3347"] as const;

type Mats = ReturnType<typeof createMaterials>;

export type ViewName = "home" | "top";

export class ApartmentScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
  readonly renderer: THREE.WebGLRenderer;
  readonly controls: OrbitControls;
  readonly center: THREE.Vector3;
  readonly homePos: THREE.Vector3;
  readonly topPos: THREE.Vector3;
  readonly size: number;

  evening = false;
  private plan: Plan;
  private mats: Mats;
  private furn = new THREE.Group();
  private wallsGroup = new THREE.Group();
  private floorMeshes = new Map<string, THREE.Mesh[]>();
  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private ambient: THREE.AmbientLight;
  private lamps: THREE.PointLight[] = [];
  private tween: null | { t0: number; d: number; p0: THREE.Vector3; p1: THREE.Vector3; q0: THREE.Vector3; q1: THREE.Vector3 } = null;
  private reduceMotion: boolean;
  private raf = 0;
  private cutaway = false;
  private onFrameCbs = new Set<() => void>();
  private resizeObs?: ResizeObserver;
  private disposed = false;
  /** until the user drags the model, the camera follows the container size */
  private interacted = false;
  private radius: number;
  private ceiling = new THREE.Group();
  private trims = new THREE.Group();
  private sky: { day: THREE.Texture; evening: THREE.Texture } | null = null;
  private composer: EffectComposer | null = null;
  private gtao: GTAOPass | null = null;
  /** ambient occlusion is switched off automatically when the device is too slow */
  private aoOn = true;
  private slowFrames = 0;
  private envTexture: THREE.Texture | null = null;
  private walker: WalkController | null = null;
  private cutawayBeforeWalk = false;
  private lastFrame = 0;
  /** called when the visitor enters another room in walk mode */
  onRoomChange?: (room: Room | undefined) => void;

  constructor(private host: HTMLElement, plan: Plan, opts: { pixelRatio?: number; autoStart?: boolean } = {}) {
    this.plan = plan;
    this.reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(opts.pixelRatio ?? Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    // photographic look: AgX tone mapping and a soft studio environment for reflections
    // Khronos PBR Neutral keeps material colours (wood, fabric) true while compressing highlights
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.environment = this.envTexture;
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    host.prepend(this.renderer.domElement);

    const [bx0, bx1, bz0, bz1] = plan.bounds;
    this.center = new THREE.Vector3((bx0 + bx1) / 2, 0, (bz0 + bz1) / 2);
    this.size = Math.max(bx1 - bx0, bz1 - bz0);
    const s = this.size;
    this.homePos = this.center.clone().add(new THREE.Vector3(-1.03 * s, 1.17 * s, 1.15 * s));
    const allRects = plan.rooms.flatMap((r) => r.rects).concat([plan.bounds]);
    this.radius =
      Math.hypot(
        Math.max(...allRects.map((q) => q[1])) - Math.min(...allRects.map((q) => q[0])),
        Math.max(...allRects.map((q) => q[3])) - Math.min(...allRects.map((q) => q[2])),
      ) / 2;
    this.topPos = new THREE.Vector3(this.center.x, 1.65 * s, this.center.z + 0.01);

    this.camera.position.copy(this.homePos);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.copy(this.center);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = PI / 2.15;
    this.controls.minDistance = 3;
    this.controls.maxDistance = s * 3.4;
    this.controls.addEventListener("start", () => {
      this.tween = null;
      this.interacted = true;
    });

    // lights
    this.hemi = new THREE.HemisphereLight(0xffffff, 0xb8b2a6, 0.62 * PI);
    this.sun = new THREE.DirectionalLight(0xfff4e2, 0.75 * PI);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    const sc = this.sun.shadow.camera;
    const half = s * 0.75;
    sc.left = -half;
    sc.right = half;
    sc.top = half;
    sc.bottom = -half;
    sc.near = 1;
    sc.far = s * 5;
    this.sun.target.position.copy(this.center);
    this.ambient = new THREE.AmbientLight(0xffffff, 0.12 * PI);
    this.scene.add(this.hemi, this.sun, this.sun.target, this.ambient);
    for (const r of plan.rooms) {
      const l = new THREE.PointLight(0xffc27a, 0, 6, 2);
      l.position.set(r.c[0], 2.2, r.c[1]);
      this.scene.add(l);
      this.lamps.push(l);
    }

    this.mats = createMaterials();
    this.scene.add(this.furn, this.wallsGroup);
    this.buildSlabAndFloors();
    this.buildCeiling();
    this.buildWalls(WALL_H);
    const details = buildDetails(plan, { trim: this.mats.trim, frame: this.mats.frame, sill: this.mats.sill, shade: this.mats.shade, dark: this.mats.dark });
    this.trims = details.trims;
    this.scene.add(details.trims, details.skirting);
    this.ceiling.add(details.lights);
    for (const item of plan.furniture) buildFurniture(item, this.furn, this.mats);
    this.setEvening(false);

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(host);
    this.resize();
    if (opts.autoStart !== false) this.raf = requestAnimationFrame(this.loop);
  }

  /** Renders one frame from an explicit camera pose (video recording). */
  renderPose(pos: THREE.Vector3, target: THREE.Vector3) {
    this.camera.position.copy(pos);
    this.camera.lookAt(target);
    this.renderer.render(this.scene, this.camera);
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  get rooms(): Room[] {
    return this.plan.rooms;
  }

  onFrame(cb: () => void) {
    this.onFrameCbs.add(cb);
    return () => this.onFrameCbs.delete(cb);
  }

  /** Screen position of a room label in CSS pixels of the host. */
  project(room: Room, cam: THREE.Camera = this.camera, w = this.host.clientWidth, h = this.host.clientHeight) {
    const v = new THREE.Vector3(room.c[0], 0.3, room.c[1]).project(cam);
    return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h, visible: v.z <= 1 };
  }

  setFurnished(on: boolean) {
    this.furn.visible = on;
  }

  setCutaway(on: boolean) {
    this.cutaway = on;
    this.buildWalls(on ? CUT_H : WALL_H);
    this.trims.visible = !on;
  }

  setEvening(eve: boolean) {
    this.evening = eve;
    const c = this.center;
    const from = this.plan.sunFrom ?? "w";
    const dir = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }[from];
    if (eve) {
      this.sun.color.setHex(0xff9a52);
      this.sun.intensity = 1.1 * PI;
      this.sun.position.set(c.x + dir[0] * 14, 3.2, c.z + dir[1] * 14 - 1.5);
      this.hemi.intensity = 0.12 * PI;
      this.hemi.color.setHex(0x9fb0d6);
      this.ambient.intensity = 0.02 * PI;
      this.scene.environmentIntensity = 0.12;
      this.lamps.forEach((l) => (l.intensity = 0.55 * PI * 5));
      this.mats.shade.emissiveIntensity = 1.4;
    } else {
      this.sun.color.setHex(0xfff1dc);
      this.sun.intensity = 1.6 * PI;
      this.sun.position.set(c.x + dir[0] * 7 - 3, 14, c.z + dir[1] * 7 + 6);
      this.hemi.intensity = 0.26 * PI;
      this.hemi.color.setHex(0xffffff);
      this.ambient.intensity = 0.03 * PI;
      this.scene.environmentIntensity = 0.3;
      this.lamps.forEach((l) => (l.intensity = 0));
      this.mats.shade.emissiveIntensity = 0;
    }
    if (this.walker && this.sky) this.scene.background = eve ? this.sky.evening : this.sky.day;
  }

  highlight(id: string | null) {
    for (const [roomId, meshes] of this.floorMeshes) {
      meshes.forEach((m) => (m.material as THREE.MeshStandardMaterial).emissive.setHex(roomId === id ? 0x2f4a38 : 0x000000));
    }
  }

  /** Camera pose that frames one room from above, keeping the current viewing direction. */
  roomPose(id: string, from: THREE.Vector3 = this.camera.position, target: THREE.Vector3 = this.controls.target) {
    const r = this.plan.rooms.find((x) => x.id === id)!;
    const t = new THREE.Vector3(r.c[0], 0.6, r.c[1]);
    const dir = from.clone().sub(target).setY(0);
    if (dir.lengthSq() < 1e-6) dir.set(-1, 0, 1);
    dir.normalize();
    const pos = t.clone().add(dir.multiplyScalar(4.2)).add(new THREE.Vector3(0, 5.6, 0));
    return { pos, target: t };
  }

  selectRoom(id: string | null) {
    this.highlight(id);
    if (!id) return;
    const { pos, target } = this.roomPose(id);
    this.flyTo(pos, target);
  }

  view(name: ViewName) {
    this.highlight(null);
    if (name === "home") this.flyTo(this.fittedHome(), this.center);
    else this.flyTo(this.topPos.clone().setY(Math.max(this.topPos.y, this.fitDistance(this.radius * 1.05))), this.center);
  }

  /** Distance at which a sphere of radius r fills the current frame. */
  fitDistance(r: number) {
    const v = THREE.MathUtils.degToRad(this.camera.fov);
    const h = 2 * Math.atan(Math.tan(v / 2) * this.camera.aspect);
    return r / Math.sin(Math.min(v, h) / 2);
  }

  /** Home view pulled back far enough for narrow (phone) containers. */
  fittedHome() {
    const dir = this.homePos.clone().sub(this.center);
    const d = Math.max(dir.length(), this.fitDistance(this.radius * 0.95));
    return this.center.clone().addScaledVector(dir.normalize(), d);
  }

  flyTo(pos: THREE.Vector3, target: THREE.Vector3, d = 900) {
    if (this.reduceMotion) {
      this.camera.position.copy(pos);
      this.controls.target.copy(target);
      return;
    }
    this.tween = { t0: performance.now(), d, p0: this.camera.position.clone(), p1: pos.clone(), q0: this.controls.target.clone(), q1: target.clone() };
  }

  /** Pauses the interactive loop (used while recording a video with another renderer). */
  pause() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  resume() {
    if (!this.raf && !this.disposed) this.raf = requestAnimationFrame(this.loop);
  }

  dispose() {
    this.disposed = true;
    this.walker?.dispose();
    this.walker = null;
    this.disposeComposer();
    this.envTexture?.dispose();
    this.sky?.day.dispose();
    this.sky?.evening.dispose();
    this.pause();
    this.resizeObs?.disconnect();
    this.controls.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
    disposeMaterials(this.mats);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  get isCutaway() {
    return this.cutaway;
  }

  get isWalking() {
    return !!this.walker;
  }

  /** First-person walk through the apartment (eye level, collisions, ceiling on). */
  enterWalk() {
    if (this.walker) return;
    this.tween = null;
    this.cutawayBeforeWalk = this.cutaway;
    if (this.cutaway) this.setCutaway(false);
    this.highlight(null);
    this.ceiling.visible = true;
    this.controls.enabled = false;
    this.sky ??= { day: skyTexture(false), evening: skyTexture(true) };
    this.scene.background = this.evening ? this.sky.evening : this.sky.day;
    this.createComposer();
    this.walker = new WalkController({
      camera: this.camera,
      dom: this.renderer.domElement,
      plan: this.plan,
      floors: [...this.floorMeshes.values()].flat(),
      occluders: () => [this.wallsGroup, this.furn],
      onRoom: (room) => this.onRoomChange?.(room),
    });
  }

  exitWalk() {
    if (!this.walker) return;
    this.walker.dispose();
    this.walker = null;
    this.ceiling.visible = false;
    this.scene.background = null;
    this.disposeComposer();
    if (this.cutawayBeforeWalk) this.setCutaway(true);
    this.controls.enabled = true;
    this.camera.position.copy(this.fittedHome());
    this.controls.target.copy(this.center);
    this.camera.up.set(0, 1, 0);
    this.controls.update();
  }

  private createComposer() {
    if (this.composer) return;
    const w = this.host.clientWidth || 800;
    const h = this.host.clientHeight || 600;
    // post-processing at most 1.5× pixel density: phones with 3× screens stay smooth
    const pr = Math.min(1.5, this.renderer.getPixelRatio());
    const target = new THREE.WebGLRenderTarget(w * pr, h * pr, { type: THREE.HalfFloatType, samples: 4 });
    const composer = new EffectComposer(this.renderer, target);
    composer.addPass(new RenderPass(this.scene, this.camera));
    const gtao = new GTAOPass(this.scene, this.camera, w, h);
    gtao.updateGtaoMaterial({ radius: 0.55, distanceExponent: 1, thickness: 1, scale: 1, samples: 16 });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 4, radius: 12, rings: 3, samples: 20 });
    gtao.blendIntensity = 1;
    composer.addPass(gtao);
    composer.addPass(new OutputPass());
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    this.composer = composer;
    this.gtao = gtao;
    this.slowFrames = 0;
  }

  private disposeComposer() {
    this.gtao?.dispose();
    this.composer?.dispose();
    this.composer = null;
    this.gtao = null;
  }

  setWalkInput(input: Partial<WalkInput>) {
    this.walker?.setInput(input);
  }

  walkToRoom(id: string) {
    const r = this.plan.rooms.find((x) => x.id === id);
    if (r && this.walker) this.walker.walkTo(r.c[0], r.c[1], r);
  }

  private resize() {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.composer?.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (!this.interacted && !this.tween && !this.walker) this.camera.position.copy(this.fittedHome());
  }

  private loop = (now: number) => {
    const dt = Math.min(0.5, (now - (this.lastFrame || now)) / 1000);
    this.lastFrame = now;
    if (this.walker) {
      this.walker.update(dt);
      // drop ambient occlusion if the device cannot keep ~28 fps
      if (this.composer && this.aoOn) {
        this.slowFrames = dt > 1 / 28 ? this.slowFrames + 1 : Math.max(0, this.slowFrames - 1);
        if (this.slowFrames > 45 && !FORCE_AO) this.aoOn = false;
      }
      if (this.composer && this.aoOn) this.composer.render(dt);
      else this.renderer.render(this.scene, this.camera);
      this.onFrameCbs.forEach((cb) => cb());
      this.raf = requestAnimationFrame(this.loop);
      return;
    }
    if (this.tween) {
      const k = Math.min(1, (now - this.tween.t0) / this.tween.d);
      const e = ease(k);
      this.camera.position.lerpVectors(this.tween.p0, this.tween.p1, e);
      this.controls.target.lerpVectors(this.tween.q0, this.tween.q1, e);
      if (k >= 1) this.tween = null;
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.onFrameCbs.forEach((cb) => cb());
    this.raf = requestAnimationFrame(this.loop);
  };

  private buildSlabAndFloors() {
    const [bx0, bx1, bz0, bz1] = this.plan.bounds;
    const slab = box(bx0, bx1, -0.25, 0, bz0, bz1, this.mats.slab, this.scene);
    slab.castShadow = false;
    if (this.plan.balcony) {
      const [x0, x1, z0, z1] = this.plan.balcony.rect;
      box(x0 - 0.05, x1 + 0.05, -0.18, 0, z0 - 0.05, z1 + 0.05, this.mats.slab, this.scene).castShadow = false;
    }
    for (const r of this.plan.rooms) {
      const meshes: THREE.Mesh[] = [];
      for (const [x0, x1, z0, z1] of r.rects) {
        const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
        geo.rotateX(-PI / 2);
        geo.translate((x0 + x1) / 2, 0.004, (z0 + z1) / 2);
        const pos = geo.attributes.position;
        const uv = geo.attributes.uv;
        const scale = r.floor === "tile" ? 1.2 : 2;
        for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / scale, pos.getZ(i) / scale);
        const mesh = new THREE.Mesh(geo, this.mats.floors[r.floor].clone());
        mesh.receiveShadow = true;
        this.scene.add(mesh);
        meshes.push(mesh);
      }
      this.floorMeshes.set(r.id, meshes);
    }
  }

  /** Ceiling over the rooms, shown only in walk mode (it would hide the model from above). */
  private buildCeiling() {
    for (const r of this.plan.rooms) {
      if (r.extra) continue;
      for (const [x0, x1, z0, z1] of r.rects) {
        const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
        geo.rotateX(PI / 2);
        geo.translate((x0 + x1) / 2, WALL_H - 0.005, (z0 + z1) / 2);
        const mesh = new THREE.Mesh(geo, this.mats.ceiling);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.ceiling.add(mesh);
      }
    }
    this.ceiling.visible = false;
    this.scene.add(this.ceiling);
  }

  private buildWalls(H: number) {
    this.scene.remove(this.wallsGroup);
    this.wallsGroup.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    this.wallsGroup = new THREE.Group();
    this.scene.add(this.wallsGroup);
    const m = this.mats;
    const wallMats = [m.wall, m.wall, m.cap, m.wall, m.wall, m.wall];
    for (const w of this.plan.walls) {
      let cur = w.a;
      for (const o of [...w.op].sort((p, q) => p.a - q.a)) {
        wallBox(w, cur, o.a, 0, H, wallMats, this.wallsGroup);
        if (o.y0 > 0) wallBox(w, o.a, o.b, 0, Math.min(o.y0, H), wallMats, this.wallsGroup);
        if (o.y1 < H) wallBox(w, o.a, o.b, o.y1, H, wallMats, this.wallsGroup);
        const top = Math.min(o.y1, H);
        if (o.glass && top > o.y0) {
          const g = wallBox(w, o.a, o.b, o.y0, top, m.glass, this.wallsGroup);
          if (g) {
            g.castShadow = false;
            g.scale[w.ax === "x" ? "z" : "x"] = 0.2;
          }
        }
        if (o.door && top > o.y0) {
          const d = wallBox(w, o.a, o.b, 0, top, m.dark, this.wallsGroup);
          if (d) d.scale[w.ax === "x" ? "z" : "x"] = 0.35;
        }
        cur = o.b;
      }
      wallBox(w, cur, w.b, 0, H, wallMats, this.wallsGroup);
    }
    if (this.plan.balcony) this.buildRailing(this.plan.balcony.rect, this.plan.balcony.attach, Math.min(1.05, H));
  }

  private buildRailing([x0, x1, z0, z1]: Rect, attach: "n" | "s" | "e" | "w", rh: number) {
    const g = this.wallsGroup;
    const { glass, metal } = this.mats;
    const t = 0.04;
    const sides: Array<[number, number, number, number]> = [];
    if (attach !== "n") sides.push([x0, x1, z0, z0 + t]);
    if (attach !== "s") sides.push([x0, x1, z1 - t, z1]);
    if (attach !== "w") sides.push([x0, x0 + t, z0, z1]);
    if (attach !== "e") sides.push([x1 - t, x1, z0, z1]);
    for (const [a, b, c, d] of sides) {
      box(a, b, 0, rh, c, d, glass, g).castShadow = false;
      box(a - 0.02, b + 0.02, rh, rh + 0.04, c - 0.02, d + 0.02, metal, g);
    }
  }
}

/* ---------- materials ---------- */

function rnd(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function canvasTex(draw: (g: CanvasRenderingContext2D, S: number) => void, size = 512) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d")!, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function createMaterials() {
  const woodTex = canvasTex((g, S) => {
    const r = rnd(7);
    g.fillStyle = "#C9A67B";
    g.fillRect(0, 0, S, S);
    const rowH = S / 8;
    for (let row = 0; row < 8; row++) {
      let x = -r() * S * 0.5;
      while (x < S) {
        const len = S * (0.35 + r() * 0.4);
        const l = 58 + r() * 12;
        g.fillStyle = `hsl(33,${38 + r() * 10}%,${l}%)`;
        g.fillRect(x, row * rowH, len, rowH);
        g.strokeStyle = "rgba(120,85,50,.12)";
        g.lineWidth = 1;
        for (let k = 0; k < 5; k++) {
          const y = row * rowH + r() * rowH;
          g.beginPath();
          g.moveTo(x, y);
          g.bezierCurveTo(x + len * 0.3, y + r() * 4 - 2, x + len * 0.6, y + r() * 4 - 2, x + len, y);
          g.stroke();
        }
        g.strokeStyle = "rgba(95,65,35,.35)";
        g.lineWidth = 2;
        g.strokeRect(x, row * rowH, len, rowH);
        x += len;
      }
    }
  });
  const tileTex = canvasTex((g, S) => {
    g.fillStyle = "#DADBD6";
    g.fillRect(0, 0, S, S);
    const n = 4;
    const s = S / n;
    const r = rnd(3);
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        g.fillStyle = `hsl(80,4%,${83 + r() * 4}%)`;
        g.fillRect(i * s + 2, j * s + 2, s - 4, s - 4);
      }
  });
  const deckTex = canvasTex((g, S) => {
    g.fillStyle = "#8E8B84";
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 10; i++) {
      g.fillStyle = i % 2 ? "#96938C" : "#8A8780";
      g.fillRect(0, (i * S) / 10 + 2, S, S / 10 - 4);
    }
  });
  // fine wood grain for furniture (the floor texture has planks)
  const grainTex = canvasTex((g, S) => {
    const r = rnd(11);
    g.fillStyle = "#c79d6e";
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 140; i++) {
      const y = r() * S;
      g.strokeStyle = `rgba(${90 + r() * 40},${60 + r() * 25},${30 + r() * 20},${0.08 + r() * 0.12})`;
      g.lineWidth = 0.5 + r() * 2;
      g.beginPath();
      g.moveTo(0, y);
      g.bezierCurveTo(S * 0.3, y + r() * 10 - 5, S * 0.6, y + r() * 10 - 5, S, y + r() * 6 - 3);
      g.stroke();
    }
  }, 256);
  const fabric = (color: number, sheenColor: number) =>
    new THREE.MeshPhysicalMaterial({ color, roughness: 0.92, sheen: 1, sheenRoughness: 0.75, sheenColor });
  const M = (color: number, o: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...o });
  return {
    wall: M(0xf1efea, { roughness: 0.92 }),
    ceiling: M(0xfafaf8, { roughness: 0.95, side: THREE.DoubleSide }),
    cap: M(0x3c4440),
    slab: M(0xb9bbb5),
    white: M(0xf4f3ef, { roughness: 0.32 }),
    oak: M(0xffffff, { map: grainTex, roughness: 0.55 }),
    sage: fabric(0x7a957f, 0xb8cdb9),
    sageL: fabric(0x93ab98, 0xc9d8cb),
    dark: M(0x2f3231, { roughness: 0.28 }),
    linen: fabric(0xefece5, 0xffffff),
    beige: fabric(0xd6cab8, 0xf0e7d8),
    rug: fabric(0xd6cfc1, 0xece6da),
    rugRound: M(0xe0cdb5),
    terra: fabric(0xc0957a, 0xe2c3ad),
    leaf: M(0x4f7d4a, { roughness: 0.6 }),
    pot: M(0xd7d2c8),
    water: M(0xbfd6db, { roughness: 0.2 }),
    metal: M(0x3d4143, { roughness: 0.3, metalness: 0.85 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xcfe3ea, transparent: true, opacity: 0.18, roughness: 0.04, metalness: 0.25, depthWrite: false }),
    trim: M(0xf7f6f2, { roughness: 0.4 }),
    frame: M(0xf2f2ef, { roughness: 0.35 }),
    sill: M(0xe4e1da, { roughness: 0.25 }),
    mirror: M(0xc9d6da, { roughness: 0.1, metalness: 0.6 }),
    shade: new THREE.MeshStandardMaterial({ color: 0xf1eadb, roughness: 0.9, emissive: 0xffb35c, emissiveIntensity: 0 }),
    floors: {
      oak: M(0xffffff, { map: woodTex, roughness: 0.75 }),
      tile: M(0xffffff, { map: tileTex, roughness: 0.5 }),
      deck: M(0xffffff, { map: deckTex }),
    },
  };
}

function disposeMaterials(m: Mats) {
  for (const v of Object.values(m)) {
    if (v instanceof THREE.Material) v.dispose();
  }
  for (const f of Object.values(m.floors)) {
    f.map?.dispose();
    f.dispose();
  }
}

/* ---------- geometry helpers ---------- */

function box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, m: THREE.Material | THREE.Material[], parent: THREE.Object3D) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), m);
  mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function cyl(x: number, z: number, r: number, y0: number, y1: number, m: THREE.Material, parent: THREE.Object3D, rTop?: number) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop ?? r, r, y1 - y0, 28), m);
  mesh.position.set(x, (y0 + y1) / 2, z);
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

/** Box with softly rounded edges (furniture reads as real objects, not blocks). */
function softBox(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, m: THREE.Material, parent: THREE.Object3D) {
  const w = x1 - x0;
  const h = y1 - y0;
  const d = z1 - z0;
  const r = Math.min(0.035, Math.min(w, h, d) * 0.3);
  const geo = r > 0.004 ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

/** Equirectangular sky for walk mode, seen through the windows. */
function skyTexture(evening: boolean) {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 512;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 0, 512);
  const stops = evening
    ? ["#1f2a4a", "#6b5f8f", "#f0a67a", "#ffd2a0", "#3a3a3e"]
    : ["#6fa3d8", "#a9cbea", "#e3eef6", "#f4f6f4", "#9aa39a"];
  [0, 0.3, 0.47, 0.5, 0.56].forEach((p, i) => grad.addColorStop(p, stops[i]));
  grad.addColorStop(1, evening ? "#262628" : "#7e877e");
  g.fillStyle = grad;
  g.fillRect(0, 0, 1024, 512);
  // distant rooftops on the horizon
  g.fillStyle = evening ? "rgba(40,36,48,.85)" : "rgba(120,128,126,.55)";
  let x = 0;
  const r = rnd(5);
  while (x < 1024) {
    const bw = 20 + r() * 60;
    const bh = 6 + r() * 26;
    g.fillRect(x, 256 - bh, bw, bh + 6);
    x += bw + r() * 12;
  }
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function wallBox(w: Wall, a: number, b: number, y0: number, y1: number, m: THREE.Material | THREE.Material[], parent: THREE.Object3D) {
  if (y1 - y0 < 0.005 || b - a < 0.005) return null;
  const h = w.t / 2;
  if (w.ax === "x") return box(a, b, y0, y1, w.c - h, w.c + h, m, parent);
  return box(w.c - h, w.c + h, y0, y1, a, b, m, parent);
}

/* ---------- furniture ----------
 * Each item is built in a canonical frame: width W along local X, depth D along
 * local Z, front facing +Z (south), then rotated to face n/s/e/w.
 */

const FACE_ROT = { s: 0, n: PI, e: PI / 2, w: -PI / 2 } as const;

function buildFurniture(item: FurnitureItem, parent: THREE.Group, m: Mats) {
  const [x0, x1, z0, z1] = item.r;
  const face = item.face ?? "s";
  const sideways = face === "e" || face === "w";
  const W = sideways ? z1 - z0 : x1 - x0;
  const D = sideways ? x1 - x0 : z1 - z0;
  const g = new THREE.Group();
  g.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
  g.rotation.y = FACE_ROT[face];
  const hw = W / 2;
  const hd = D / 2;
  const b = (ax0: number, ax1: number, y0: number, y1: number, az0: number, az1: number, mat: THREE.Material) => softBox(ax0, ax1, y0, y1, az0, az1, mat, g);
  const c = (x: number, z: number, r: number, y0: number, y1: number, mat: THREE.Material, rTop?: number) => cyl(x, z, r, y0, y1, mat, g, rTop);
  const chair = (x: number, z: number, rot: number, mat: THREE.Material) => {
    const ch = new THREE.Group();
    box(-0.21, 0.21, 0.43, 0.47, -0.21, 0.21, mat, ch);
    box(-0.21, 0.21, 0.47, 0.88, 0.17, 0.21, mat, ch);
    for (const [px, pz] of [[-0.19, -0.19], [0.17, -0.19], [-0.19, 0.17], [0.17, 0.17]]) box(px, px + 0.03, 0, 0.43, pz, pz + 0.03, m.dark, ch);
    ch.position.set(x, 0, z);
    ch.rotation.y = rot;
    g.add(ch);
  };
  const lampShade = (x: number, z: number, y0: number, y1: number, r: number) => {
    const s = c(x, z, r, y0, y1, m.shade, r * 0.6);
    s.castShadow = false;
  };

  switch (item.kind) {
    case "rug":
      b(-hw, hw, 0, 0.012, -hd, hd, m.rug).castShadow = false;
      break;
    case "sofa": {
      b(-hw, hw, 0.1, 0.42, -hd, hd, m.sage);
      b(-hw, hw, 0.42, 0.86, -hd, -hd + 0.22, m.sage);
      b(-hw, -hw + 0.2, 0.42, 0.62, -hd, hd, m.sage);
      b(hw - 0.2, hw, 0.42, 0.62, -hd, hd, m.sage);
      const inner = W - 0.4;
      b(-hw + 0.22, -hw + 0.18 + inner / 2, 0.42, 0.52, -hd + 0.05, hd - 0.04, m.sageL);
      b(-hw + 0.22 + inner / 2, hw - 0.22, 0.42, 0.52, -hd + 0.05, hd - 0.04, m.sageL);
      b(-hw + 0.3, -hw + 0.65, 0.52, 0.82, -hd + 0.22, -hd + 0.38, m.beige);
      break;
    }
    case "coffeeTable": {
      const r = Math.min(W, D) / 2;
      c(0, 0, r, 0.36, 0.4, m.oak);
      c(0, 0, 0.05, 0, 0.36, m.dark);
      break;
    }
    case "tvUnit": {
      b(-hw, hw, 0, 0.45, -hd, hd, m.oak);
      const tw = Math.min(1.3, W - 0.4) / 2;
      b(-tw, tw, 0.6, 1.3, -hd + 0.02, -hd + 0.06, m.dark);
      break;
    }
    case "floorLamp":
      c(0, 0, 0.14, 0, 0.03, m.dark);
      c(0, 0, 0.015, 0.03, 1.45, m.dark);
      lampShade(0, 0, 1.35, 1.62, 0.22);
      break;
    case "plant": {
      const h = item.h ?? 0.35;
      c(0, 0, 0.16, 0, 0.32, m.pot, 0.19);
      const f = new THREE.Mesh(new THREE.IcosahedronGeometry(h, 3), m.leaf);
      f.position.set(0, 0.32 + h * 0.95, 0);
      f.scale.y = 1.25;
      f.castShadow = true;
      g.add(f);
      break;
    }
    case "diningTable": {
      b(-hw, hw, 0.72, 0.76, -hd, hd, m.oak);
      for (const [px, pz] of [[-hw + 0.05, -hd + 0.05], [hw - 0.09, -hd + 0.05], [-hw + 0.05, hd - 0.09], [hw - 0.09, hd - 0.09]])
        b(px, px + 0.04, 0, 0.72, pz, pz + 0.04, m.dark);
      const n = W > 1.2 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const cx = n === 1 ? 0 : -W / 4 + (i * W) / 2;
        chair(cx, -hd - 0.35, PI, m.oak);
        chair(cx, hd + 0.35, 0, m.oak);
        c(cx, 0, 0.006, 1.75, 2.7, m.dark);
        lampShade(cx, 0, 1.58, 1.75, 0.18);
      }
      break;
    }
    case "kitchen": {
      b(-hw, hw, 0, 0.88, -hd, hd, m.white);
      b(-hw, hw, 0.88, 0.92, -hd, hd + 0.02, m.oak);
      if (W > 1.4) {
        b(-hw + W * 0.25, -hw + W * 0.25 + 0.5, 0.915, 0.925, -hd + 0.1, hd - 0.1, m.metal);
        b(hw - W * 0.3, hw - W * 0.3 + 0.55, 0.92, 0.93, -hd + 0.08, hd - 0.08, m.dark);
      }
      b(-hw, hw, 1.45, 2.2, -hd, -hd + 0.35, m.white);
      break;
    }
    case "bed":
    case "singleBed": {
      const single = item.kind === "singleBed";
      b(-hw, hw, 0, 0.35, -hd, hd, single ? m.white : m.oak);
      b(-hw + 0.05, hw - 0.05, 0.35, 0.55, -hd + 0.05, hd - 0.05, m.linen);
      b(-hw, hw, 0, single ? 0.8 : 1.05, -hd - 0.04, -hd + 0.06, single ? m.white : m.sage);
      b(-hw + 0.02, hw - 0.02, 0.55, 0.6, -hd + D * 0.3, hd - 0.03, single ? m.terra : m.beige);
      const pw = single ? W * 0.7 : W * 0.4;
      if (single) b(-pw / 2, pw / 2, 0.55, 0.68, -hd + 0.1, -hd + 0.45, m.white);
      else {
        b(-hw + 0.1, -hw + 0.1 + pw, 0.55, 0.68, -hd + 0.1, -hd + 0.5, m.white);
        b(hw - 0.1 - pw, hw - 0.1, 0.55, 0.68, -hd + 0.1, -hd + 0.5, m.white);
      }
      break;
    }
    case "nightstand":
      b(-hw, hw, 0, 0.5, -hd, hd, m.oak);
      c(0, 0, 0.1, 0.5, 0.53, m.dark);
      c(0, 0, 0.012, 0.53, 0.8, m.dark);
      lampShade(0, 0, 0.72, 0.88, 0.13);
      break;
    case "wardrobe": {
      const h = item.h ?? 2.3;
      b(-hw, hw, 0, h, -hd, hd, m.white);
      const doors = Math.max(1, Math.round(W / 0.6));
      for (let i = 1; i < doors; i++) {
        const x = -hw + (i * W) / doors;
        b(x - 0.01, x + 0.01, 0.2, h - 0.1, hd, hd + 0.01, m.cap);
      }
      break;
    }
    case "shelf": {
      const h = item.h ?? 1.2;
      b(-hw, hw, 0, h, -hd, hd, m.white);
      if (h > 0.9) for (let y = 0.4; y < h - 0.2; y += 0.4) b(-hw + 0.02, hw - 0.02, y, y + 0.02, -hd + 0.02, hd + 0.005, m.oak);
      else b(-hw, hw, h, h + 0.02, -hd, hd, m.oak);
      break;
    }
    case "desk":
      b(-hw, hw, 0.72, 0.76, -hd, hd, m.oak);
      for (const px of [-hw + 0.02, hw - 0.06]) for (const pz of [-hd + 0.02, hd - 0.06]) b(px, px + 0.04, 0, 0.72, pz, pz + 0.04, m.white);
      chair(0, hd + 0.35, 0, m.white);
      break;
    case "bathtub":
      b(-hw, hw, 0, 0.55, -hd, hd, m.white);
      b(-hw + 0.1, hw - 0.1, 0.5, 0.53, -hd + 0.1, hd - 0.1, m.water);
      break;
    case "sink":
      b(-hw, hw, 0.45, 0.85, -hd, hd, m.oak);
      b(-hw + 0.02, hw - 0.02, 0.85, 0.9, -hd + 0.02, hd, m.white);
      b(-hw * 0.8, hw * 0.8, 1.1, 1.9, -hd - 0.02, -hd, m.mirror);
      break;
    case "toilet":
      b(-hw + 0.02, hw - 0.02, 0, 0.42, -hd + 0.12, hd, m.white);
      b(-hw, hw, 0.42, 0.8, -hd, -hd + 0.16, m.white);
      break;
    case "outdoorSet":
      c(0, 0, 0.28, 0.68, 0.71, m.metal);
      c(0, 0, 0.03, 0, 0.68, m.metal);
      chair(-0.55, 0, PI / 2, m.metal);
      chair(0.55, 0, -PI / 2, m.metal);
      break;
  }
  parent.add(g);
}

function ease(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
