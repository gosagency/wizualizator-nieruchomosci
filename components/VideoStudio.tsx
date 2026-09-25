"use client";

import { useState } from "react";
import { putBlob, useMediaUrl } from "@/lib/demo/blobs";
import { updateOffer, useOrg } from "@/lib/demo/store";
import type { Offer, Org, Video, VideoKind } from "@/lib/demo/types";
import { formatArea, formatPrice } from "@/lib/plan/area";
import { Button, Card, Pill } from "@/components/ui";

type Job = { kind: VideoKind; format: Video["format"] };

const JOBS: Array<Job & { title: string; text: string }> = [
  { kind: "tour3d", format: "9:16", title: "Spacer 3D · rolka 9:16", text: "Przelot kamery po modelu z nazwami pokoi i ceną. Na Reels, TikTok, Shorts." },
  { kind: "tour3d", format: "16:9", title: "Spacer 3D · poziomy 16:9", text: "Do ogłoszenia na portalu, na stronę biura i do prezentacji." },
  { kind: "photo3d", format: "9:16", title: "Film 3D ze zdjęć · 9:16", text: "Każde zdjęcie oferty zamienione w scenę 3D, kamera przejeżdża przez pokoje." },
  { kind: "reel", format: "9:16", title: "Rolka · 9:16", text: "Zdjęcia i wizualizacje pokoi z płynnym ruchem, cena, metraż i kontakt do agenta." },
];

/** Estimates depth for every offer photo on this device, then records the 3D photo film. */
async function recordOfferPhoto3D(offer: Offer, org: Org, format: Video["format"], setPhase: (p: string) => void, setProgress: (p: number) => void) {
  const [{ estimateDepth }, { recordPhoto3D }, { getBlob }] = await Promise.all([import("@/lib/depth/depth"), import("@/lib/video/photo3d"), import("@/lib/demo/blobs")]);
  const items = [];
  for (const [i, photo] of offer.photos.entries()) {
    setPhase(`Analiza zdjęć ${i + 1}/${offer.photos.length}`);
    const blob = await getBlob(photo.src);
    if (!blob) continue;
    const depth = await estimateDepth(blob, (m) => m.phase === "download" && setProgress(m.progress));
    const room = offer.rooms.find((r) => r.name === photo.roomName);
    items.push({ depth, caption: photo.roomName, subtitle: room ? `${formatArea(room.area)} · wizualizacja 3D` : undefined });
    setProgress((i + 1) / offer.photos.length);
  }
  setPhase("Nagrywanie");
  setProgress(0);
  return recordPhoto3D(items, org, format, { intro: offerIntro(offer), outro: offerOutro(offer) }, setProgress);
}

function offerIntro(offer: Offer) {
  return [
    { text: [offer.district, offer.city].filter(Boolean).join(", "), size: 22, weight: 500, opacity: 0.85 },
    { text: offer.title, size: 40, weight: 700, gap: 14 },
    { text: formatPrice(offer.price), size: 34, weight: 700 },
  ];
}

function offerOutro(offer: Offer) {
  return [
    { text: "Obejrzyj mieszkanie w 3D", size: 30, weight: 700, gap: 14 },
    { text: offer.agent.name, size: 22, weight: 600 },
    { text: offer.agent.phone, size: 22, weight: 500, opacity: 0.85 },
  ];
}

function newVideo(job: Job, src: string, mime: string): Video {
  return { id: crypto.randomUUID(), kind: job.kind, format: job.format, src, mime, createdAt: Date.now() };
}

export const VIDEO_LABEL: Record<VideoKind, string> = {
  tour3d: "Spacer 3D",
  reel: "Rolka",
  photo3d: "Film 3D ze zdjęć",
};

export function VideoStudio({ offer }: { offer: Offer }) {
  const org = useOrg();
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState("Nagrywanie");
  const [error, setError] = useState<string | null>(null);

  const run = async (job: Job) => {
    setError(null);
    setBusy(`${job.kind}-${job.format}`);
    setProgress(0);
    setPhase("Nagrywanie");
    try {
      const { blob, mime } =
        job.kind === "tour3d"
          ? await (await import("@/lib/video/tour")).recordTour(offer, org, job.format, setProgress)
          : job.kind === "photo3d"
            ? await recordOfferPhoto3D(offer, org, job.format, setPhase, setProgress)
            : await (await import("@/lib/video/reel")).recordReel(offer, org, job.format, setProgress);
      const video = newVideo(job, await putBlob(blob), mime);
      updateOffer(offer.id, (o) => ({ ...o, videos: [video, ...o.videos.filter((v) => !(v.kind === job.kind && v.format === job.format))] }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się nagrać filmu.");
    } finally {
      setBusy(null);
    }
  };

  const hasImages = offer.photos.length + offer.renders.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {JOBS.map((job) => {
          const id = `${job.kind}-${job.format}`;
          const done = offer.videos.some((v) => v.kind === job.kind && v.format === job.format);
          const disabled = !!busy || (job.kind === "reel" && !hasImages) || (job.kind === "photo3d" && offer.photos.length === 0);
          return (
            <Card key={id} className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold">{job.title}</h3>
                <Pill tone="brand">0 zł</Pill>
              </div>
              <p className="flex-1 text-sm leading-6 text-stone-600">{job.text}</p>
              {busy === id ? (
                <div className="flex flex-col gap-1.5">
                  <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                    <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
                  </div>
                  <p className="text-xs text-stone-500">
                    {phase}… {Math.round(progress * 100)}%
                  </p>
                </div>
              ) : (
                <Button onClick={() => run(job)} disabled={disabled} variant={done ? "secondary" : "primary"}>
                  {done ? "Nagraj ponownie" : "Utwórz film"}
                </Button>
              )}
              {job.kind === "reel" && !hasImages && <p className="text-xs text-stone-500">Trwa tworzenie wizualizacji pokoi…</p>}
              {job.kind === "photo3d" && offer.photos.length === 0 && (
                <p className="text-xs text-stone-500">Oferta nie ma zdjęć. Dodaj je w nowej ofercie albo wypróbuj na stronie „Ze zdjęcia do 3D”.</p>
              )}
            </Card>
          );
        })}
      </div>
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {offer.videos.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {offer.videos.map((v) => (
            <VideoCard key={v.id} video={v} offer={offer} />
          ))}
        </div>
      )}
    </div>
  );
}

export function VideoCard({ video, offer, download = true }: { video: Video; offer: Offer; download?: boolean }) {
  const url = useMediaUrl(video.src);
  const ext = video.mime.includes("mp4") ? "mp4" : "webm";
  return (
    <figure className="flex flex-col gap-2">
      <div className={`overflow-hidden rounded-2xl bg-stone-900 ${video.format === "9:16" ? "aspect-[9/16]" : "aspect-video"}`}>
        {url && <video src={url} controls playsInline muted loop className="h-full w-full object-contain" />}
      </div>
      <figcaption className="flex items-center justify-between gap-2 text-sm">
        <span>
          <span className="font-medium">{VIDEO_LABEL[video.kind]}</span>
          <span className="text-stone-500">
            {" "}
            · {video.format}
            {video.roomName ? ` · ${video.roomName}` : ""}
          </span>
        </span>
        {download && url && (
          <a href={url} download={`${offer.slug}-${video.kind}-${video.format.replace(":", "x")}.${ext}`} className="text-brand hover:underline">
            Pobierz
          </a>
        )}
      </figcaption>
    </figure>
  );
}
