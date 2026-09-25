"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Card, Pill } from "@/components/ui";
import { fetchVideo, jobStatus, submitJob, workerHealth, workerUrl } from "@/lib/aiVideo/client";
import type { Org } from "@/lib/demo/types";

export type AiPhoto = { id: string; file: Blob; caption: string };

type Format = "16:9" | "9:16";
type Job = {
  photoId: string;
  caption: string;
  jobId?: string;
  status: "sending" | "queued" | "running" | "done" | "error";
  progress?: number;
  position?: number;
  url?: string;
  error?: string;
};

/** Minutes per clip on the owner's laptop GPU (RTX 5060 8 GB, Wan 2.2 5B, 1280×704, 4 s). */
const MINUTES_PER_CLIP = 5;

export function AiVideoPanel({ photos, org }: { photos: AiPhoto[]; org: Org }) {
  const [worker, setWorker] = useState<{ url: string | null; ok: boolean | null; queue: number | null }>({ url: null, ok: null, queue: null });
  const [format, setFormat] = useState<Format>("16:9");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [final, setFinal] = useState<{ url: string; ext: string; format: Format } | null>(null);
  const [montage, setMontage] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const montageStarted = useRef(false);

  useEffect(() => {
    const url = workerUrl();
    if (!url) {
      void Promise.resolve().then(() => setWorker({ url: null, ok: false, queue: null }));
      return;
    }
    workerHealth(url).then((h) => setWorker({ url, ...h }));
  }, []);

  // Poll active jobs; download each clip when ready.
  useEffect(() => {
    const base = worker.url;
    const active = jobs.filter((j) => j.jobId && (j.status === "queued" || j.status === "running"));
    if (!base || active.length === 0) return;
    const timer = setInterval(async () => {
      for (const j of active) {
        const s = await jobStatus(base, j.jobId!).catch(() => null);
        if (!s) continue;
        if (s.status === "done") {
          const blob = await fetchVideo(base, j.jobId!).catch(() => null);
          setJobs((xs) => xs.map((x) => (x.jobId === j.jobId ? (blob ? { ...x, status: "done", url: URL.createObjectURL(blob) } : { ...x, status: "error", error: "Nie udało się pobrać filmu." }) : x)));
        } else {
          setJobs((xs) => xs.map((x) => (x.jobId === j.jobId ? { ...x, status: s.status, progress: s.progress, position: s.position, error: s.error } : x)));
        }
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [jobs, worker.url]);

  // When every clip is ready, join them into one branded film.
  useEffect(() => {
    const done = jobs.filter((j) => j.status === "done" && j.url);
    const pending = jobs.some((j) => j.status !== "done" && j.status !== "error");
    if (!jobs.length || pending || done.length === 0 || montageStarted.current) return;
    montageStarted.current = true;
    (async () => {
      setMontage(0);
      try {
        const { recordMontage } = await import("@/lib/video/montage");
        const { blob, mime } = await recordMontage(
          done.map((j) => ({ src: j.url!, caption: j.caption })),
          org,
          format,
          {
            intro: [
              { text: "Mieszkanie na sprzedaż", size: 22, weight: 500, opacity: 0.85 },
              { text: org.name, size: 36, weight: 700 },
            ],
            outro: [
              { text: "Umów oglądanie", size: 30, weight: 700, gap: 12 },
              { text: org.name, size: 22, weight: 500, opacity: 0.9 },
            ],
          },
          (p) => setMontage(p),
        );
        setFinal({ url: URL.createObjectURL(blob), ext: mime.includes("mp4") ? "mp4" : "webm", format });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Nie udało się połączyć klipów.");
      } finally {
        setMontage(null);
      }
    })();
  }, [jobs, org, format]);

  const start = async () => {
    const base = worker.url;
    if (!base || !photos.length) return;
    setError(null);
    setFinal(null);
    montageStarted.current = false;
    const initial: Job[] = photos.map((p) => ({ photoId: p.id, caption: p.caption, status: "sending" }));
    setJobs(initial);
    for (const p of photos) {
      try {
        const jobId = await submitJob(base, p.file, p.caption, format);
        setJobs((xs) => xs.map((x) => (x.photoId === p.id ? { ...x, jobId, status: "queued" } : x)));
      } catch (e) {
        setJobs((xs) => xs.map((x) => (x.photoId === p.id ? { ...x, status: "error", error: e instanceof Error ? e.message : "Błąd" } : x)));
      }
    }
  };

  const busy = jobs.some((j) => j.status === "sending" || j.status === "queued" || j.status === "running") || montage !== null;
  const remaining = jobs.filter((j) => j.status === "queued" || j.status === "running" || j.status === "sending").length;

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Film AI z ruchem kamery</h2>
          <p className="mt-1 max-w-2xl text-sm text-stone-600">
            Każde zdjęcie zamienia się w 4-sekundowe ujęcie HD z płynnym ruchem kamery, a potem w jeden film z logo biura. Film zaczyna się i kończy na prawdziwym zdjęciu, więc meble zostają na miejscu. Generuje go otwarty model Wan 2.2 na naszym serwerze, bez płatnych usług.
          </p>
        </div>
        <Pill tone={worker.ok ? "brand" : "stone"}>
          {worker.ok === null ? "Łączenie z serwerem wideo…" : worker.ok ? `Serwer wideo online${worker.queue ? ` · w kolejce: ${worker.queue}` : ""}` : "Serwer wideo offline"}
        </Pill>
      </div>

      {worker.ok === false && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Serwer wideo jest teraz wyłączony. Model 3D i film 3D działają normalnie. Film AI będzie dostępny, gdy serwer zostanie uruchomiony.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-full bg-stone-100 p-0.5 text-sm">
          {(["16:9", "9:16"] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={format === f}
              disabled={busy}
              onClick={() => setFormat(f)}
              className={`rounded-full px-3 py-1.5 font-medium ${format === f ? "bg-white shadow-sm" : "text-stone-500"}`}
            >
              {f === "16:9" ? "Poziomy 16:9" : "Rolka 9:16"}
            </button>
          ))}
        </div>
        <Button onClick={start} disabled={!worker.ok || !photos.length || busy}>
          {busy ? "Trwa generowanie…" : `Utwórz film AI (${photos.length} ${photos.length === 1 ? "ujęcie" : photos.length < 5 ? "ujęcia" : "ujęć"})`}
        </Button>
        {photos.length > 0 && !busy && <span className="text-xs text-stone-500">ok. {photos.length * MINUTES_PER_CLIP} min</span>}
      </div>

      {jobs.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {jobs.map((j) => (
            <li key={j.photoId} className="flex flex-col gap-2 rounded-2xl bg-stone-50 p-3 ring-1 ring-stone-900/5">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium">{j.caption}</span>
                <span className="text-xs text-stone-500">
                  {j.status === "sending" && "wysyłanie…"}
                  {j.status === "queued" && `w kolejce${j.position ? ` (${j.position})` : ""}`}
                  {j.status === "running" && `${Math.round((j.progress ?? 0) * 100)}%`}
                  {j.status === "done" && "gotowe"}
                  {j.status === "error" && "błąd"}
                </span>
              </div>
              {j.url ? (
                <video src={j.url} muted loop autoPlay playsInline className={`w-full rounded-xl bg-stone-900 ${format === "9:16" ? "aspect-[9/16]" : "aspect-video"}`} />
              ) : (
                <div className="h-1.5 overflow-hidden rounded-full bg-stone-200">
                  <div className="h-full rounded-full bg-brand transition-[width] duration-700" style={{ width: `${Math.round((j.progress ?? (j.status === "queued" ? 0.02 : 0)) * 100)}%` }} />
                </div>
              )}
              {j.error && <p className="text-xs text-red-700">{j.error}</p>}
            </li>
          ))}
        </ul>
      )}

      {remaining > 0 && <p className="text-xs text-stone-500">Zostało ujęć: {remaining}. Możesz w tym czasie obejrzeć widok 3D poniżej.</p>}
      {montage !== null && <p className="text-sm text-stone-600">Łączenie ujęć w jeden film… {Math.round(montage * 100)}%</p>}
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {final && (
        <figure className="flex max-w-3xl flex-col gap-2">
          <video src={final.url} controls playsInline autoPlay muted className={`w-full rounded-2xl bg-stone-900 ${final.format === "9:16" ? "mx-auto aspect-[9/16] max-w-sm" : "aspect-video"}`} />
          <figcaption className="flex items-center justify-between text-sm">
            <span className="font-medium">Film AI · {final.format}</span>
            <a href={final.url} download={`film-ai-${final.format.replace(":", "x")}.${final.ext}`} className="text-brand hover:underline">
              Pobierz
            </a>
          </figcaption>
        </figure>
      )}
    </Card>
  );
}
