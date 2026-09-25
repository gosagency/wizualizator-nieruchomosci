import * as THREE from "three";
import type { PhotoDepth } from "@/lib/depth/depth";

/*
 * "3D photo": every pixel of the photo is pushed back along its camera ray
 * according to the estimated depth. Seen from the original camera position the
 * mesh looks exactly like the photo; moving the camera gives real parallax.
 */

/** Field of view of a typical phone main camera along the photo's long side. */
const LONG_SIDE_FOV = THREE.MathUtils.degToRad(66);
/** distance = 1 / (A + B·disparity): far ≈ 3.3, near ≈ 0.85 units */
const A = 0.3;
const B = 0.88;
/** Where the camera looks while moving (mid-depth). */
export const FOCUS = new THREE.Vector3(0, 0, -1.9);

export function photoFov(d: PhotoDepth) {
  const aspect = d.width / d.height;
  const t = Math.tan(LONG_SIDE_FOV / 2);
  return aspect >= 1 ? { h: LONG_SIDE_FOV, v: 2 * Math.atan(t / aspect) } : { v: LONG_SIDE_FOV, h: 2 * Math.atan(t * aspect) };
}

export function buildPhotoMesh(d: PhotoDepth): THREE.Mesh {
  const { gridW: gw, gridH: gh, grid } = d;
  const fov = photoFov(d);
  const tx = Math.tan(fov.h / 2);
  const ty = Math.tan(fov.v / 2);
  const pos = new Float32Array(gw * gh * 3);
  const uv = new Float32Array(gw * gh * 2);
  for (let j = 0; j < gh; j++) {
    for (let i = 0; i < gw; i++) {
      const k = j * gw + i;
      const u = i / (gw - 1);
      const v = j / (gh - 1);
      const dist = 1 / (A + B * grid[k]);
      pos[k * 3] = (u - 0.5) * 2 * tx * dist;
      pos[k * 3 + 1] = (0.5 - v) * 2 * ty * dist;
      pos[k * 3 + 2] = -dist;
      uv[k * 2] = u;
      uv[k * 2 + 1] = 1 - v;
    }
  }
  const index: number[] = [];
  for (let j = 0; j < gh - 1; j++) {
    for (let i = 0; i < gw - 1; i++) {
      const a = j * gw + i;
      const b = a + 1;
      const c = a + gw;
      const e = c + 1;
      index.push(a, c, b, b, c, e);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.setIndex(index);
  const tex = new THREE.CanvasTexture(d.image);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.MeshBasicMaterial({ map: tex });
  return new THREE.Mesh(geo, mat);
}

/** Vertical FOV that makes the photo cover a frame of the given aspect (like CSS object-fit: cover). */
export function coverFov(d: PhotoDepth, frameAspect: number, zoom = 0.9) {
  const fov = photoFov(d);
  const photoAspect = d.width / d.height;
  const v = frameAspect <= photoAspect ? fov.v : 2 * Math.atan(Math.tan(fov.h / 2) / frameAspect);
  return THREE.MathUtils.radToDeg(v) * zoom;
}

export function disposeMesh(m: THREE.Mesh) {
  m.geometry.dispose();
  const mat = m.material as THREE.MeshBasicMaterial;
  mat.map?.dispose();
  mat.dispose();
}
