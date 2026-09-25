"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { AiVideoPanel } from "@/components/AiVideoPanel";
import { Button, ButtonLink, Card, PageHeader, Pill } from "@/components/ui";
import { useOrg } from "@/lib/demo/store";
import type { ModelProgress, PhotoDepth } from "@/lib/depth/depth";

const Photo3DViewer = dynamic(() => import("@/components/photo3d/Photo3DViewer"), { ssr: false });

type Item = {
  id: string;
  file: File;
  preview: string;
  caption: string;
  status: "waiting" | "analyzing" | "ready" | "error";
  depth?: PhotoDepth;
};

type Clip = { format: "9:16" | "16:9"; url: string; ext: string };

const ROOMS = ["Salon", "Kuchnia", "Sypialnia", "Pokój", "Łazienka", "Przedpokój", "Balkon"];
const MAX_PHOTOS = 8;

export default function TryPhoto3D() {
  const org = useOrg();
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [model, setModel] = useState<ModelProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState<{ format: Clip["format"]; progress: number } | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const queue = useRef<Item[]>([]);
  const running = useRef(false);

  // Analyse photos one by one (depth estimation runs on this device).
  const runQueue = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      const { estimateDepth } = await import("@/lib/depth/depth");
      while (queue.current.length) {
        const next = queue.current.shift()!;
        setItems((xs) => xs.map((x) => (x.id === next.id ? { ...x, status: "analyzing" } : x)));
        try {
          const depth = await estimateDepth(next.file, setModel);
          setItems((xs) => xs.map((x) => (x.id === next.id ? { ...x, status: "ready", depth } : x)));
          setSelected((sel) => sel ?? next.id);
        } catch (e) {
          console.error(e);
          setError("Nie udało się przeanalizować zdjęcia. Sprawdź połączenie z internetem (model pobiera się przy pierwszym użyciu) i spróbuj ponownie.");
          setItems((xs) => xs.map((x) => (x.id === next.id ? { ...x, status: "error" } : x)));
        }
      }
    } finally {
      running.current = false;
    }
  }, []);

  useEffect(() => {
    // Start downloading the model as soon as the page opens.
    import("@/lib/depth/depth").then((m) => m.loadDepthModel(setModel)).catch(() => undefined);
  }, []);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    setError(null);
    const add = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, MAX_PHOTOS - items.length)
      .map((file, i) => ({
        id: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
        caption: ROOMS[(items.length + i) % ROOMS.length],
        status: "waiting" as const,
      }));
    setItems((xs) => [...xs, ...add]);
    queue.current.push(...add);
    void runQueue();
  };

  const record = async (format: Clip["format"]) => {
    const ready = items.filter((i) => i.depth);
    if (!ready.length) return;
    setError(null);
    setRecording({ format, progress: 0 });
    try {
      const { recordPhoto3D } = await import("@/lib/video/photo3d");
      const { blob, mime } = await recordPhoto3D(
        ready.map((i) => ({ depth: i.depth!, caption: i.caption })),
        org,
        format,
        {
          intro: [
            { text: "Mieszkanie w 3D", size: 22, weight: 500, opacity: 0.85 },
            { text: org.name, size: 36, weight: 700 },
          ],
          outro: [
            { text: "Wizualizacja 3D ze zdjęć", size: 28, weight: 700, gap: 12 },
            { text: org.name, size: 22, weight: 500, opacity: 0.9 },
          ],
        },
        (p) => setRecording({ format, progress: p }),
      );
      const url = URL.createObjectURL(blob);
      setClips((cs) => [{ format, url, ext: mime.includes("mp4") ? "mp4" : "webm" }, ...cs.filter((c) => c.format !== format)]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się nagrać filmu.");
    } finally {
      setRecording(null);
    }
  };

  const current = items.find((i) => i.id === selected && i.depth);
  const readyCount = items.filter((i) => i.depth).length;
  const downloading = model?.phase === "download";

  return (
    <>
      <PageHeader
        title="Ze zdjęć do filmu i 3D"
        subtitle="Wgraj zdjęcia pokoi z telefonu. Powstanie film z ruchem kamery (AI), scena 3D do obracania i rolka do social mediów. Bez płatnych usług."
      />

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Pill tone="brand">0 zł · bez zewnętrznych usług</Pill>
        <Pill>{model?.phase === "ready" ? `Model 3D gotowy (${model.backend === "webgpu" ? "karta graficzna" : "procesor"})` : downloading ? `Pobieranie modelu 3D… ${Math.round((model?.progress ?? 0) * 100)}%` : "Przygotowanie modelu 3D…"}</Pill>
      </div>

      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-stone-300 bg-white px-6 py-10 text-center transition hover:border-brand">
        <span className="text-3xl">📷</span>
        <span className="font-medium">Wybierz lub zrób zdjęcia pokoi</span>
        <span className="text-xs text-stone-500">Do {MAX_PHOTOS} zdjęć. Najlepiej poziomo, z rogu pokoju, przy dobrym świetle.</span>
        <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => addFiles(e.target.files)} />
      </label>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {items.length > 0 && <AiVideoPanel photos={items.map((i) => ({ id: i.id, file: i.file, caption: i.caption }))} org={org} />}

      {items.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <div className="flex flex-col gap-3">
            {current?.depth ? (
              <Photo3DViewer key={current.id} depth={current.depth} className="aspect-[4/3] w-full" />
            ) : (
              <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 rounded-3xl bg-stone-900 text-sm text-white/80">
                <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                {downloading ? `Pobieranie modelu 3D (jednorazowo)… ${Math.round((model?.progress ?? 0) * 100)}%` : "Odtwarzanie głębi zdjęcia…"}
              </div>
            )}
            <p className="text-xs leading-5 text-stone-500">
              Scena 3D: głębia szacowana ze zdjęcia przez model Depth Anything V2 w Twojej przeglądarce (to zdjęcie nie jest nigdzie wysyłane). Film AI: zdjęcie trafia tylko na nasz serwer wideo. Wszystko to wizualizacje poglądowe.
            </p>
          </div>

          <aside className="flex flex-col gap-3">
            <ul className="flex flex-col gap-2">
              {items.map((it) => (
                <li key={it.id}>
                  <div
                    className={`flex items-center gap-3 rounded-2xl bg-white p-2 ring-1 transition ${selected === it.id ? "ring-2 ring-brand" : "ring-stone-900/5"}`}
                  >
                    <button type="button" onClick={() => it.depth && setSelected(it.id)} className="shrink-0" aria-label={`Pokaż ${it.caption} w 3D`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={it.preview} alt="" className="h-14 w-20 rounded-xl object-cover" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <input
                        list="rooms"
                        value={it.caption}
                        onChange={(e) => setItems((xs) => xs.map((x) => (x.id === it.id ? { ...x, caption: e.target.value } : x)))}
                        className="w-full rounded-lg bg-transparent px-1 py-0.5 text-sm font-medium focus:bg-stone-50 focus:outline-none"
                        aria-label="Nazwa pomieszczenia"
                      />
                      <p className="px-1 text-xs text-stone-500">
                        {it.status === "ready" ? "Gotowe w 3D" : it.status === "analyzing" ? "Analiza głębi…" : it.status === "error" ? "Błąd" : "W kolejce"}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <datalist id="rooms">
              {ROOMS.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>

            <Card className="flex flex-col gap-2 p-4 sm:p-4">
              <h2 className="font-semibold">Film 3D ze zdjęć</h2>
              <p className="text-xs text-stone-500">Kamera przejeżdża przez każde zdjęcie w 3D. Około 5 s na zdjęcie.</p>
              {(["9:16", "16:9"] as const).map((f) =>
                recording?.format === f ? (
                  <div key={f} className="flex flex-col gap-1">
                    <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${Math.round(recording.progress * 100)}%` }} />
                    </div>
                    <p className="text-xs text-stone-500">Nagrywanie {f}… {Math.round(recording.progress * 100)}%</p>
                  </div>
                ) : (
                  <Button key={f} onClick={() => record(f)} disabled={!readyCount || !!recording} variant={f === "9:16" ? "primary" : "secondary"}>
                    {f === "9:16" ? "Rolka 9:16" : "Film 16:9"} {readyCount > 0 && `(${readyCount} zdj.)`}
                  </Button>
                ),
              )}
            </Card>
          </aside>
        </div>
      )}

      {clips.length > 0 && (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clips.map((c) => (
            <figure key={c.url} className="flex flex-col gap-2">
              <video src={c.url} controls playsInline muted loop autoPlay className={`w-full rounded-2xl bg-stone-900 ${c.format === "9:16" ? "aspect-[9/16]" : "aspect-video"}`} />
              <figcaption className="flex items-center justify-between text-sm">
                <span className="font-medium">Film 3D · {c.format}</span>
                <a href={c.url} download={`film-3d-${c.format.replace(":", "x")}.${c.ext}`} className="text-brand hover:underline">
                  Pobierz
                </a>
              </figcaption>
            </figure>
          ))}
        </section>
      )}

      <Card className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold">Chcesz model całego mieszkania?</h2>
          <p className="text-sm text-stone-600">Dodaj ofertę: metraż pokoi wystarczy, żeby powstał model 3D, spacer i link do ogłoszenia.</p>
        </div>
        <ButtonLink href="/oferty/nowa" className="shrink-0">
          Dodaj ofertę
        </ButtonLink>
      </Card>
    </>
  );
}
