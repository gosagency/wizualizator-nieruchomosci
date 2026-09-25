"use client";

import { useEffect, useRef, useState } from "react";
import type { Plan } from "@/lib/plan/types";
import { formatArea, roomsArea } from "@/lib/plan/area";
import { PreviewBadge } from "@/components/PreviewBadge";
import type { ApartmentScene } from "./apartmentScene";

type Props = {
  plan: Plan;
  /** brand color for accents */
  accent?: string;
  className?: string;
};

function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex rounded-full bg-white/85 p-0.5 text-xs shadow-sm ring-1 ring-black/5 backdrop-blur">
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={`rounded-full px-3 py-1.5 font-medium transition-colors ${value === v ? "bg-stone-900 text-white" : "text-stone-600 hover:text-stone-900"}`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

export default function ApartmentViewer({ plan, accent = "#b45309", className = "" }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ApartmentScene | null>(null);
  const [furn, setFurn] = useState<"on" | "off">("on");
  const [walls, setWalls] = useState<"full" | "cut">("full");
  const [time, setTime] = useState<"day" | "eve">("day");
  const [selected, setSelected] = useState<string | null>(null);
  const [hint, setHint] = useState(true);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let unsub: (() => void) | undefined;
    import("./apartmentScene").then(({ ApartmentScene }) => {
      if (cancelled) return;
      const s = new ApartmentScene(host, plan);
      sceneRef.current = s;
      const labels = labelsRef.current;
      const off = s.onFrame(() => {
        if (!labels) return;
        for (const el of Array.from(labels.children) as HTMLElement[]) {
          const room = s.rooms.find((r) => r.id === el.dataset.id);
          if (!room) continue;
          const p = s.project(room);
          el.style.display = p.visible ? "" : "none";
          el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
        }
      });
      unsub = () => {
        off();
      };
    });
    return () => {
      cancelled = true;
      unsub?.();
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, [plan]);

  const select = (id: string | null) => {
    setSelected(id);
    setHint(false);
    sceneRef.current?.selectRoom(id);
  };

  const room = plan.rooms.find((r) => r.id === selected);
  const total = roomsArea(plan.rooms);

  return (
    <div className={`grid gap-4 lg:grid-cols-[1fr_280px] ${className}`}>
      <div
        ref={hostRef}
        onPointerDown={() => setHint(false)}
        className={`relative h-[62vh] min-h-[380px] overflow-hidden rounded-3xl ring-1 ring-black/5 transition-[background] duration-700 ${time === "eve" ? "bg-gradient-to-b from-[#1b2231] to-[#3b3347]" : "bg-gradient-to-b from-[#e8edf1] to-[#f7f5f0]"}`}
      >
        <div ref={labelsRef} className="pointer-events-none absolute inset-0">
          {plan.rooms.map((r) => (
            <button
              key={r.id}
              type="button"
              data-id={r.id}
              onClick={() => select(r.id)}
              className="pointer-events-auto absolute left-0 top-0 whitespace-nowrap rounded-full bg-white/90 px-2.5 py-1 text-[11px] leading-tight text-stone-800 shadow-sm ring-1 ring-black/5 backdrop-blur transition-colors"
              style={selected === r.id ? { background: accent, color: "white" } : undefined}
            >
              <b className="font-semibold">{r.name}</b> <span className="opacity-70">{formatArea(r.area)}</span>
            </button>
          ))}
        </div>

        <div className="absolute inset-x-3 top-3 flex flex-wrap gap-2">
          <Seg label="Umeblowanie" value={furn} onChange={(v) => { setFurn(v); sceneRef.current?.setFurnished(v === "on"); }} options={[["on", "Umeblowane"], ["off", "Stan deweloperski"]]} />
          <Seg label="Ściany" value={walls} onChange={(v) => { setWalls(v); sceneRef.current?.setCutaway(v === "cut"); }} options={[["full", "Pełne ściany"], ["cut", "Przekrój"]]} />
          <Seg label="Pora dnia" value={time} onChange={(v) => { setTime(v); sceneRef.current?.setEvening(v === "eve"); }} options={[["day", "Dzień"], ["eve", "Wieczór"]]} />
        </div>

        <div className="pointer-events-none absolute inset-x-3 bottom-3 flex flex-wrap-reverse items-end justify-between gap-2">
          <div className="pointer-events-auto flex gap-2">
          <button type="button" onClick={() => { select(null); sceneRef.current?.view("home"); }} className="rounded-full bg-white/85 px-3 py-1.5 text-xs font-medium text-stone-700 shadow-sm ring-1 ring-black/5 backdrop-blur hover:text-stone-950">
            Cały lokal
          </button>
          <button type="button" onClick={() => { select(null); sceneRef.current?.view("top"); }} className="rounded-full bg-white/85 px-3 py-1.5 text-xs font-medium text-stone-700 shadow-sm ring-1 ring-black/5 backdrop-blur hover:text-stone-950">
            Rzut z góry
          </button>
          </div>
          <PreviewBadge />
        </div>

        {hint && (
          <p className="pointer-events-none absolute inset-x-0 bottom-24 mx-auto w-fit rounded-full bg-stone-900/75 px-3 py-1.5 text-xs text-white">
            Przeciągnij, aby obrócić · kliknij pokój
          </p>
        )}
      </div>

      <aside className="flex flex-col gap-3">
        <ul className="divide-y divide-stone-900/5 overflow-hidden rounded-2xl bg-white ring-1 ring-black/5">
          {plan.rooms.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                aria-pressed={selected === r.id}
                onClick={() => select(r.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-stone-50"
                style={selected === r.id ? { boxShadow: `inset 3px 0 0 ${accent}` } : undefined}
              >
                <span>{r.name}</span>
                <span className="tabular-nums text-stone-500">{formatArea(r.area)}</span>
              </button>
            </li>
          ))}
          <li className="flex items-center justify-between px-4 py-2.5 text-sm font-semibold">
            <span>Razem (bez balkonu)</span>
            <span className="tabular-nums">{formatArea(total)}</span>
          </li>
        </ul>
        {room && (
          <div className="rounded-2xl bg-white p-4 ring-1 ring-black/5">
            <h3 className="font-semibold">
              {room.name} · {formatArea(room.area)}
            </h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-stone-600">
              {room.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-xs leading-5 text-stone-500">
          Wizualizacja poglądowa. Umeblowanie nie jest częścią oferty. Wymiary orientacyjne.
        </p>
      </aside>
    </div>
  );
}
