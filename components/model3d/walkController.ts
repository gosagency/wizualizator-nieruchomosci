import * as THREE from "three";
import type { Plan, Room } from "@/lib/plan/types";
import { buildObstacles, EYE_HEIGHT, findPath, moveWithCollisions, roomAt, walkStart } from "@/lib/plan/walk";

/*
 * First-person "walk" through the apartment model (like Matterport / Marble).
 * Keyboard: W/S or ↑/↓ move, A/D strafe, ←/→ turn, Shift walks faster.
 * Mouse / finger: drag to look around, click / tap the floor to walk there.
 */

const WALK_SPEED = 1.4;
const RUN_SPEED = 2.6;
const TURN_SPEED = 1.9;
const WALK_FOV = 70;

export type WalkInput = { forward: number; turn: number };

type Options = {
  camera: THREE.PerspectiveCamera;
  dom: HTMLElement;
  plan: Plan;
  floors: THREE.Mesh[];
  /** meshes that hide the floor behind them (walls, furniture) */
  occluders: () => THREE.Object3D[];
  onRoom?: (room: Room | undefined) => void;
};

export class WalkController {
  private obstacles;
  private x: number;
  private z: number;
  private yaw: number;
  private pitch = -0.08;
  private keys = new Set<string>();
  private virtual: WalkInput = { forward: 0, turn: 0 };
  /** remaining waypoints of a click-to-walk route */
  private route: Array<{ x: number; z: number }> = [];
  /** after arriving, turn to face this point (the far corner of the room: the widest view) */
  private lookAt: { x: number; z: number } | null = null;
  private stuck = 0;
  private drag: { id: number; x: number; y: number; sx: number; sy: number } | null = null;
  private room: Room | undefined;
  private raycaster = new THREE.Raycaster();
  private prevFov: number;

  constructor(private o: Options) {
    this.obstacles = buildObstacles(o.plan);
    const s = walkStart(o.plan);
    this.x = s.x;
    this.z = s.z;
    this.yaw = s.yaw;
    this.prevFov = o.camera.fov;
    o.camera.fov = WALK_FOV;
    o.camera.updateProjectionMatrix();
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    o.dom.addEventListener("pointerdown", this.onPointerDown);
    o.dom.addEventListener("pointermove", this.onPointerMove);
    o.dom.addEventListener("pointerup", this.onPointerUp);
    o.dom.addEventListener("pointercancel", this.onPointerUp);
    o.dom.addEventListener("wheel", this.onWheel, { passive: false });
    o.dom.style.cursor = "grab";
    this.apply();
  }

  setInput(input: Partial<WalkInput>) {
    this.virtual = { ...this.virtual, ...input };
    if (input.forward || input.turn) this.route = [];
  }

  /** Walks along a route around walls and furniture to (x, z) or the nearest reachable spot. */
  walkTo(x: number, z: number, room?: Room) {
    this.route = findPath(this.o.plan, { x: this.x, z: this.z }, { x, z }, this.obstacles);
    this.stuck = 0;
    this.lookAt = null;
    if (room) {
      // Stop about 70 cm past the doorway, like a real estate photographer: the whole room is in view.
      const inside = (p: { x: number; z: number }) => roomAt(this.o.plan, p.x, p.z)?.id === room.id;
      const cut: Array<{ x: number; z: number }> = [];
      let prev = { x: this.x, z: this.z };
      let walked = inside(prev) ? 0.7 : -1;
      for (const wp of this.route) {
        const len = Math.hypot(wp.x - prev.x, wp.z - prev.z);
        let stopAt: { x: number; z: number } | null = null;
        for (let d = 0.1; d <= len && !stopAt; d += 0.1) {
          const p = { x: prev.x + ((wp.x - prev.x) * d) / len, z: prev.z + ((wp.z - prev.z) * d) / len };
          if (walked < 0 && inside(p)) walked = 0;
          else if (walked >= 0) walked += 0.1;
          if (walked >= 0.7) stopAt = p;
        }
        if (stopAt) {
          cut.push(stopAt);
          break;
        }
        cut.push(wp);
        prev = wp;
      }
      if (walked >= 0.7) this.route = cut;
      // the corner of the room farthest from where the route ends, 30 cm inside
      const end = this.route[this.route.length - 1] ?? { x: this.x, z: this.z };
      const corners = room.rects.flatMap(([x0, x1, z0, z1]) => [
        { x: x0 + 0.3, z: z0 + 0.3 },
        { x: x1 - 0.3, z: z0 + 0.3 },
        { x: x0 + 0.3, z: z1 - 0.3 },
        { x: x1 - 0.3, z: z1 - 0.3 },
      ]);
      this.lookAt = corners.reduce((a, b) => (Math.hypot(b.x - end.x, b.z - end.z) > Math.hypot(a.x - end.x, a.z - end.z) ? b : a));
    }
  }

  /** Advances the walk; long frames (slow phones) are split into small steps so walls still stop the visitor. */
  update(dt: number) {
    for (let left = Math.min(dt, 0.5); left > 1e-4; left -= 0.03) this.step(Math.min(0.03, left));
    this.apply();
  }

  private step(dt: number) {
    const k = this.keys;
    const forward = (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0) - (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0) + this.virtual.forward;
    const strafe = (k.has("KeyD") ? 1 : 0) - (k.has("KeyA") ? 1 : 0);
    const turn = (k.has("ArrowLeft") ? 1 : 0) - (k.has("ArrowRight") ? 1 : 0) + this.virtual.turn;
    const speed = k.has("ShiftLeft") || k.has("ShiftRight") ? RUN_SPEED : WALK_SPEED;
    this.yaw += turn * TURN_SPEED * dt;

    let dx = 0;
    let dz = 0;
    const target = this.route[0];
    if (forward || strafe || turn) this.lookAt = null;
    if (!target && this.lookAt) {
      let diff = Math.atan2(-(this.lookAt.x - this.x), -(this.lookAt.z - this.z)) - this.yaw;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      if (Math.abs(diff) < 0.01) this.lookAt = null;
      else this.yaw += diff * Math.min(1, dt * 4);
    }
    if (forward || strafe) {
      this.route = [];
      const fx = -Math.sin(this.yaw);
      const fz = -Math.cos(this.yaw);
      const len = Math.hypot(forward, strafe) || 1;
      dx = ((fx * forward - fz * strafe) / len) * speed * dt;
      dz = ((fz * forward + fx * strafe) / len) * speed * dt;
    } else if (target) {
      const tx = target.x - this.x;
      const tz = target.z - this.z;
      const d = Math.hypot(tx, tz);
      if (d < 0.12) {
        this.route.shift();
      } else {
        const step = Math.min(d, speed * dt);
        dx = (tx / d) * step;
        dz = (tz / d) * step;
        // turn gently towards the walking direction
        const heading = Math.atan2(-tx, -tz);
        let diff = heading - this.yaw;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        this.yaw += diff * Math.min(1, dt * 3);
      }
    }
    if (dx || dz) {
      const r = moveWithCollisions(this.x, this.z, dx, dz, this.obstacles);
      this.x = r.x;
      this.z = r.z;
      if (this.route.length) {
        this.stuck = r.blocked ? this.stuck + dt : 0;
        if (this.stuck > 0.4) this.route = [];
      }
    }
  }

  dispose() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    const d = this.o.dom;
    d.removeEventListener("pointerdown", this.onPointerDown);
    d.removeEventListener("pointermove", this.onPointerMove);
    d.removeEventListener("pointerup", this.onPointerUp);
    d.removeEventListener("pointercancel", this.onPointerUp);
    d.removeEventListener("wheel", this.onWheel);
    d.style.cursor = "";
    this.o.camera.fov = this.prevFov;
    this.o.camera.updateProjectionMatrix();
  }

  private apply() {
    const cam = this.o.camera;
    cam.position.set(this.x, EYE_HEIGHT, this.z);
    cam.rotation.set(this.pitch, this.yaw, 0, "YXZ");
    const room = roomAt(this.o.plan, this.x, this.z);
    if (room?.id !== this.room?.id) {
      this.room = room;
      this.o.onRoom?.(room);
    }
  }

  private isTyping() {
    const el = document.activeElement as HTMLElement | null;
    return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.isTyping()) return;
    const handled = ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "ShiftLeft", "ShiftRight"];
    if (!handled.includes(e.code)) return;
    this.keys.add(e.code);
    if (e.code.startsWith("Arrow")) e.preventDefault();
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onBlur = () => {
    this.keys.clear();
    this.virtual = { forward: 0, turn: 0 };
  };

  private onPointerDown = (e: PointerEvent) => {
    this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY };
    this.o.dom.setPointerCapture(e.pointerId);
    this.o.dom.style.cursor = "grabbing";
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.drag || e.pointerId !== this.drag.id) return;
    const dx = e.clientX - this.drag.x;
    const dy = e.clientY - this.drag.y;
    this.drag.x = e.clientX;
    this.drag.y = e.clientY;
    // "grab" the view: dragging right turns the camera left, like Matterport
    this.yaw += dx * 0.0045;
    this.pitch = Math.max(-1.1, Math.min(0.9, this.pitch + dy * 0.0035));
  };

  private onPointerUp = (e: PointerEvent) => {
    if (!this.drag || e.pointerId !== this.drag.id) return;
    const moved = Math.hypot(e.clientX - this.drag.sx, e.clientY - this.drag.sy);
    this.drag = null;
    this.o.dom.style.cursor = "grab";
    if (moved < 6) this.clickFloor(e);
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const step = Math.max(-0.6, Math.min(0.6, -e.deltaY * 0.004));
    const r = moveWithCollisions(this.x, this.z, -Math.sin(this.yaw) * step, -Math.cos(this.yaw) * step, this.obstacles);
    this.x = r.x;
    this.z = r.z;
    this.route = [];
    this.apply();
  };

  private clickFloor(e: PointerEvent) {
    const rect = this.o.dom.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.o.camera);
    // glass (windows, balcony door) does not block the click
    const hit = this.raycaster
      .intersectObjects([...this.o.floors, ...this.o.occluders()], true)
      .find((h) => h.object.visible && !((h.object as THREE.Mesh).material as THREE.Material).transparent);
    if (!hit || !this.o.floors.includes(hit.object as THREE.Mesh)) return;
    if (Math.hypot(hit.point.x - this.x, hit.point.z - this.z) > 14) return;
    this.walkTo(hit.point.x, hit.point.z);
  }
}
