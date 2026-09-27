"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Card, Pill } from "@/components/ui";
import { fetchVideo, jobStatus, submitJob, workerHealth, workerUrl } from "@/lib/aiVideo/client";
import { useMediaUrl } from "@/lib/demo/blobs";
import type { MediaRef, Org } from "@/lib/demo/types";
import type { CardLine } from "@/lib/video/overlay";

/** A photo for the AI film; `file` can load lazily (offer photos live in IndexedDB). */
export type AiPhoto = { id: string; caption: string; subtitle?: string; file: Blob | (() => Promise<Blob | undefined>); thumb?: MediaRef };

type Format = "16:9" | "9:16";
type Job = {
  photoId: string;
  caption: string;
  subtitle?: string;
  jobId?: string;
  status: "sending" | "queued" | "running" | "done" | "error";
  progress?: number;
  position?: number;
  url?: string;
  error?: string;
};

/** Minutes per clip on the owner's laptop GPU (RTX 5060 8 GB, Wan 2.2 5B, 1280×704, 4 s). */
const MINUTES_PER_CLIP = 5;

const DEFAULT_CARDS = (org: Org): { intro: CardLine[]; outro: CardLine[] } => ({
  intro: [
    { text: "Mieszkanie na sprzedaż", size: 22, weight: 500, opacity: 0.85 },
    { text: org.name, size: 36, weight: 700 },
  ],
  outro: [
    { text: "Umów oglądanie", size: 30, weight: 700, gap: 12 },
    { text: org.name, size: 22, weight: 500, opacity: 0.9 },
  ],
});

/** First photo of each room, then the rest, up to n. */
function defaultPick(photos: AiPhoto[], n: number): string[] {
  const out: string[] = [];
  const rooms = new Set<string>();
  for (const p of photos) {
    if (out.length < n && !rooms.has(p.caption)) {
      rooms.add(p.caption);
      out.push(p.id);
    }
  }
  for (const p of photos) if (out.length < n && !out.includes(p.id)) out.push(p.id);
  return out;
}

const clipsLabel = (n: number) => `${n} ${n === 1 ? "ujęcie" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "ujęcia" : "ujęć"}`;

type Props = {
  photos: AiPhoto[];
  org: Org;
  /** Let the agent choose photos, starting with this many (each clip takes minutes). */
  pick?: number;
  cards?: { intro: CardLine[]; outro: CardLine[] };
  /** Called with the finished film instead of only showing it (e.g. save it in the offer). */
  onFinished?: (film: { blob: Blob; mime: string; format: Format }) => Promise<void> | void;
};

export function AiVideoPanel({ photos, org, pick, cards, onFinished }: Props) {
  const [worker, setWorker] = useState<{ url: string | null; ok: boolean | null; queue: number | null }>({ url: null, ok: null, queue: null });
  const [format, setFormat] = useState<Format>("16:9");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [final, setFinal] = useState<{ url: string; ext: string; format: Format } | null>(null);
  const [montage, setMontage] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [picked, setPicked] = useState<string[] | null>(null);
  const montageStarted = useRef(false);
  const chosenIds = pick ? (picked ?? defaultPick(photos, pick)) : photos.map((p) => p.id);
  const chosen = photos.filter((p) => chosenIds.includes(p.id));

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
          done.map((j) => ({ src: j.url!, caption: j.caption, subtitle: j.subtitle })),
          org,
          format,
          cards ?? DEFAULT_CARDS(org),
          (p) => setMontage(p),
        );
        if (onFinished) {
          await onFinished({ blob, mime, format });
          setSaved(true);
        } else {
          setFinal({ url: URL.createObjectURL(blob), ext: mime.includes("mp4") ? "mp4" : "webm", format });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Nie udało się połączyć klipów.");
      } finally {
        setMontage(null);
      }
    })();
  }, [jobs, org, format, cards, onFinished]);

  const start = async () => {
    const base = worker.url;
    if (!base || !chosen.length) return;
    setError(null);
    setFinal(null);
    setSaved(false);
    montageStarted.current = false;
    const initial: Job[] = chosen.map((p) => ({ photoId: p.id, caption: p.caption, subtitle: p.subtitle, status: "sending" }));
    setJobs(initial);
    for (const p of chosen) {
      try {
        const file = typeof p.file === "function" ? await p.file() : p.file;
        if (!file) throw new Error("Nie udało się wczytać zdjęcia.");
        const jobId = await submitJob(base, file, p.caption, format);
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

      {pick && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-stone-600">Wybierz zdjęcia do filmu. Jedno zdjęcie to jedno ujęcie, ok. {MINUTES_PER_CLIP} min generowania.</p>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {photos.map((p) => {
              const on = chosenIds.includes(p.id);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    aria-label={`${p.caption}: ${on ? "w filmie" : "pominięte"}`}
                    disabled={busy}
                    onClick={() => setPicked(on ? chosenIds.filter((id) => id !== p.id) : [...chosenIds, p.id])}
                    className={`relative block w-full overflow-hidden rounded-xl text-left ring-2 transition ${on ? "ring-brand" : "opacity-60 ring-transparent hover:opacity-100"}`}
                  >
                    <Thumb src={p.thumb} alt={p.caption} />
                    <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 pb-1 pt-4 text-xs font-medium text-white">{p.caption}</span>
                    {on && <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-xs text-white">✓</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

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
        <Button onClick={start} disabled={!worker.ok || !chosen.length || busy}>
          {busy ? "Trwa generowanie…" : `Utwórz film AI (${clipsLabel(chosen.length)})`}
        </Button>
        {chosen.length > 0 && !busy && <span className="text-xs text-stone-500">ok. {chosen.length * MINUTES_PER_CLIP} min</span>}
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

      {remaining > 0 && (
        <p className="text-xs text-stone-500">
          Zostało ujęć: {remaining}, ok. {remaining * MINUTES_PER_CLIP} min. Nie zamykaj tej strony, film złoży się sam.
        </p>
      )}
      {montage !== null && <p className="text-sm text-stone-600">Łączenie ujęć w jeden film… {Math.round(montage * 100)}%</p>}
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {saved && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Film AI jest gotowy i zapisany w ofercie. Widać go poniżej i na stronie oferty.</p>}

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

function Thumb({ src, alt }: { src?: MediaRef; alt: string }) {
  const url = useMediaUrl(src);
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt={alt} className="aspect-[4/3] w-full object-cover" /> : <div className="aspect-[4/3] w-full animate-pulse bg-stone-200" />;
}
