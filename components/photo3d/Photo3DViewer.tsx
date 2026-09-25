"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { PhotoDepth } from "@/lib/depth/depth";
import { PreviewBadge } from "@/components/PreviewBadge";
import { buildPhotoMesh, coverFov, disposeMesh, FOCUS } from "./photoMesh";

/** Interactive 3D photo: drag (or move the mouse) to look around; idles with a gentle sway. */
export default function Photo3DViewer({ depth, className = "" }: { depth: PhotoDepth; className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"3d" | "depth">("3d");
  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.domElement.style.cssText = "display:block;width:100%;height:100%;touch-action:none";
    host.prepend(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#111");
    const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 50);
    const mesh = buildPhotoMesh(depth);
    scene.add(mesh);
    const depthTex = new THREE.CanvasTexture(depth.depthPreview);
    const photoTex = (mesh.material as THREE.MeshBasicMaterial).map;

    const target = { x: 0, y: 0 };
    const cur = { x: 0, y: 0 };
    let lastInput = -1e9;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" && e.buttons === 0) return;
      const r = host.getBoundingClientRect();
      target.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
      target.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
      lastInput = performance.now();
    };
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerdown", onMove);

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.fov = coverFov(depth, camera.aspect);
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const loop = (now: number) => {
      const idle = now - lastInput > 2500;
      const tx = idle && !reduce ? Math.sin(now / 1900) * 0.7 : target.x;
      const ty = idle && !reduce ? Math.sin(now / 2700) * 0.35 : target.y;
      cur.x += (tx - cur.x) * 0.06;
      cur.y += (ty - cur.y) * 0.06;
      camera.position.set(cur.x * 0.22, -cur.y * 0.12, 0.12 + Math.abs(cur.x) * 0.05);
      camera.lookAt(FOCUS);
      (mesh.material as THREE.MeshBasicMaterial).map = modeRef.current === "depth" ? depthTex : photoTex;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerdown", onMove);
      (mesh.material as THREE.MeshBasicMaterial).map = photoTex;
      disposeMesh(mesh);
      depthTex.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [depth]);

  return (
    <div ref={hostRef} className={`relative overflow-hidden rounded-3xl bg-stone-900 ${className}`}>
      <div className="absolute left-3 top-3 flex rounded-full bg-white/85 p-0.5 text-xs shadow-sm backdrop-blur">
        {(
          [
            ["3d", "Widok 3D"],
            ["depth", "Mapa głębi"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            aria-pressed={mode === v}
            onClick={() => setMode(v)}
            className={`rounded-full px-3 py-1.5 font-medium ${mode === v ? "bg-stone-900 text-white" : "text-stone-600"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="pointer-events-none absolute inset-x-0 bottom-3 mx-auto w-fit rounded-full bg-black/55 px-3 py-1 text-xs text-white">
        Przesuń palcem lub myszką
      </p>
      <PreviewBadge className="absolute bottom-3 right-3 hidden sm:inline-flex" />
    </div>
  );
}
