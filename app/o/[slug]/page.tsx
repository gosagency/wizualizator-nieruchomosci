"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { BrandStyle } from "@/components/BrandStyle";
import { OrgMark } from "@/components/OrgMark";
import { VideoCard } from "@/components/VideoStudio";
import { useMediaUrl } from "@/lib/demo/blobs";
import { useRoomViews } from "@/lib/demo/roomViews";
import { useHydrated, useOffer, useOrg } from "@/lib/demo/store";
import type { Offer } from "@/lib/demo/types";
import { formatArea, formatPrice } from "@/lib/plan/area";

const ApartmentViewer = dynamic(() => import("@/components/model3d/ApartmentViewer"), {
  ssr: false,
  loading: () => <div className="h-[62vh] min-h-[380px] animate-pulse rounded-3xl bg-stone-200/60" />,
});

export default function PublicOffer() {
  const { slug } = useParams<{ slug: string }>();
  const hydrated = useHydrated();
  const offer = useOffer(slug);
  const org = useOrg();
  useRoomViews(hydrated && offer ? [offer] : []);

  if (!hydrated) return null;
  if (!offer) {
    return <p className="p-10 text-center text-stone-500">Oferta nie istnieje albo została wycofana.</p>;
  }
  const rooms = offer.rooms.filter((r) => !["balkon", "przedpokoj", "lazienka", "wc"].includes(r.kind)).length;
  const videos = [...offer.videos].sort((a, b) => (a.kind === "tour3d" ? -1 : 0) - (b.kind === "tour3d" ? -1 : 0));
  const gallery = [
    ...offer.photos.map((p) => ({ id: p.id, src: p.src, caption: p.roomName ?? "" })),
    ...offer.renders.map((r) => ({ id: r.id, src: r.after, caption: `${r.roomName} · wizualizacja` })),
  ];

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <BrandStyle />
      <header className="border-b border-stone-900/5 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <OrgMark org={org} size={32} />
          <span className="font-semibold">{org.name}</span>
          {offer.agent.phone && (
            <a href={`tel:${offer.agent.phone.replace(/\s/g, "")}`} className="ml-auto rounded-full bg-brand px-4 py-2 text-sm font-medium text-white">
              Zadzwoń
            </a>
          )}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8">
        <section className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-end">
          <div>
            <p className="text-sm text-stone-500">{[offer.street, offer.district, offer.city].filter(Boolean).join(", ")}</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">{offer.title}</h1>
            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Fact label="Cena" value={formatPrice(offer.price)} strong />
              <Fact label="Za m²" value={formatPrice(Math.round(offer.price / offer.area))} />
              <Fact label="Powierzchnia" value={formatArea(offer.area)} />
              <Fact label="Pokoje · piętro" value={`${rooms} · ${offer.floor}`} />
            </dl>
          </div>
          <AgentCard offer={offer} />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">Mieszkanie w 3D</h2>
          <ApartmentViewer plan={offer.plan} accent={org.color} />
        </section>

        {videos.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold">Filmy</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {videos.map((v) => (
                <VideoCard key={v.id} video={v} offer={offer} download={false} />
              ))}
            </div>
          </section>
        )}

        {gallery.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold">Zdjęcia i wizualizacje</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {gallery.map((g) => (
                <GalleryImage key={g.id} src={g.src} caption={g.caption} />
              ))}
            </div>
          </section>
        )}

        {offer.description && (
          <section className="max-w-3xl">
            <h2 className="text-xl font-semibold">Opis</h2>
            <p className="mt-2 leading-7 text-stone-700">{offer.description}</p>
          </section>
        )}
      </main>

      <footer className="border-t border-stone-900/5 bg-white px-4 py-6 text-center text-xs leading-5 text-stone-500">
        Wizualizacje, model 3D i filmy mają charakter poglądowy. Umeblowanie nie jest częścią oferty, wymiary są orientacyjne.
        <br />
        Oferta: {org.name}
      </footer>
    </div>
  );
}

function Fact({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-stone-900/5">
      <dt className="text-xs text-stone-500">{label}</dt>
      <dd className={`mt-0.5 tabular-nums ${strong ? "text-lg font-semibold" : "font-medium"}`}>{value}</dd>
    </div>
  );
}

function AgentCard({ offer }: { offer: Offer }) {
  const { agent } = offer;
  return (
    <div className="flex flex-col gap-3 rounded-3xl bg-white p-5 ring-1 ring-stone-900/5">
      <p className="text-xs text-stone-500">Agent prowadzący</p>
      <p className="text-lg font-semibold">{agent.name}</p>
      <div className="flex flex-wrap gap-2">
        {agent.phone && (
          <a href={`tel:${agent.phone.replace(/\s/g, "")}`} className="flex-1 whitespace-nowrap rounded-full bg-brand px-4 py-2.5 text-center text-sm font-medium text-white">
            {agent.phone}
          </a>
        )}
        {agent.email && (
          <a href={`mailto:${agent.email}?subject=${encodeURIComponent(offer.title)}`} className="flex-1 rounded-full bg-stone-100 px-4 py-2.5 text-center text-sm font-medium text-stone-800">
            Napisz
          </a>
        )}
      </div>
    </div>
  );
}

function GalleryImage({ src, caption }: { src: string; caption: string }) {
  const url = useMediaUrl(src);
  return (
    <figure className="relative overflow-hidden rounded-2xl bg-stone-200">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url && <img src={url} alt={caption} className="aspect-[4/3] w-full object-cover" />}
      {caption && <figcaption className="absolute left-2 top-2 rounded-full bg-black/55 px-2.5 py-1 text-xs text-white">{caption}</figcaption>}
    </figure>
  );
}
