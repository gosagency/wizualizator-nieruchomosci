"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { BeforeAfter } from "@/components/BeforeAfter";
import { Button, ButtonLink, Card, Pill } from "@/components/ui";
import { VideoStudio } from "@/components/VideoStudio";
import { useMediaUrl } from "@/lib/demo/blobs";
import { useRoomViews } from "@/lib/demo/roomViews";
import { removeOffer, updateOffer, useHydrated, useOffer, useOrg } from "@/lib/demo/store";
import { STYLE_LABELS, type Offer, type Photo, type RoomRender } from "@/lib/demo/types";
import { formatArea, formatPrice } from "@/lib/plan/area";

const ApartmentViewer = dynamic(() => import("@/components/model3d/ApartmentViewer"), {
  ssr: false,
  loading: () => <div className="h-[62vh] min-h-[380px] animate-pulse rounded-3xl bg-stone-200/60" />,
});

const TABS = [
  ["model", "Model 3D"],
  ["filmy", "Filmy"],
  ["zdjecia", "Zdjęcia i wizualizacje"],
  ["publikacja", "Publikacja"],
] as const;
type Tab = (typeof TABS)[number][0];

export default function OfferPage() {
  const { id } = useParams<{ id: string }>();
  const hydrated = useHydrated();
  const offer = useOffer(id);
  const org = useOrg();
  const [tab, setTab] = useState<Tab>("model");
  useRoomViews(hydrated && offer ? [offer] : []);

  if (!hydrated) return null;
  if (!offer) {
    return (
      <Card className="text-center">
        <p>Nie znaleziono oferty.</p>
        <ButtonLink href="/" variant="secondary" className="mt-4">
          Wróć do listy
        </ButtonLink>
      </Card>
    );
  }

  const perM2 = Math.round(offer.price / offer.area);

  return (
    <>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href="/" className="text-sm text-stone-500 hover:text-stone-800">
            ← Oferty
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{offer.title}</h1>
            {offer.sample && <Pill tone="amber">Oferta przykładowa</Pill>}
          </div>
          <p className="mt-1 text-stone-500">
            {[offer.street, offer.district, offer.city].filter(Boolean).join(", ")}
          </p>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-600">
            <span className="text-lg font-semibold text-stone-900">{formatPrice(offer.price)}</span>
            <span>{formatPrice(perM2)}/m²</span>
            <span>{formatArea(offer.area)}</span>
            <span>piętro {offer.floor}</span>
            <span>styl: {STYLE_LABELS[offer.style]}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/o/${offer.slug}`} target="_blank" variant="secondary">
            Strona oferty ↗
          </ButtonLink>
          <Button onClick={() => setTab("publikacja")}>Udostępnij</Button>
        </div>
      </div>

      <div role="tablist" className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-stone-900/10">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition ${tab === key ? "border-brand text-stone-900" : "border-transparent text-stone-500 hover:text-stone-800"}`}
          >
            {label}
            {key === "filmy" && offer.videos.length > 0 && <span className="ml-1.5 text-stone-400">{offer.videos.length}</span>}
          </button>
        ))}
      </div>

      {tab === "model" && <ApartmentViewer plan={offer.plan} accent={org.color} />}
      {tab === "filmy" && <VideoStudio offer={offer} />}
      {tab === "zdjecia" && <PhotosAndViews offer={offer} />}
      {tab === "publikacja" && <Publish offer={offer} />}
    </>
  );
}

function PhotosAndViews({ offer }: { offer: Offer }) {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Wizualizacje pokoi</h2>
            <p className="text-sm text-stone-500">Z modelu 3D: stan deweloperski i przykładowe umeblowanie. Przesuń suwak, żeby porównać.</p>
          </div>
          <Pill tone="brand">0 zł</Pill>
        </div>
        {offer.renders.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {offer.renders.map((r) => (
              <RenderCard key={r.id} render={r} offer={offer} />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="flex aspect-[4/3] items-center justify-center rounded-2xl bg-stone-200/70 text-sm text-stone-500">
                Tworzenie wizualizacji…
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Zdjęcia ({offer.photos.length})</h2>
        {offer.photos.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {offer.photos.map((p) => (
              <PhotoTile key={p.id} photo={p} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-stone-500">Brak zdjęć. Agent może je dodać przy tworzeniu oferty.</p>
        )}
      </section>
    </div>
  );
}

function RenderCard({ render, offer }: { render: RoomRender; offer: Offer }) {
  const after = useMediaUrl(render.after);
  const before = useMediaUrl(render.before);
  if (!after) return <div className="aspect-[4/3] animate-pulse rounded-2xl bg-stone-200" />;
  const room = offer.rooms.find((r) => r.name === render.roomName);
  return (
    <figure className="flex flex-col gap-2">
      <BeforeAfter before={before} after={after} alt={render.roomName} />
      <figcaption className="flex items-center justify-between gap-2 text-sm">
        <span>
          <span className="font-medium">{render.roomName}</span>
          {room && <span className="text-stone-500"> · {formatArea(room.area)}</span>}
        </span>
        <a href={after} download={`${offer.slug}-${render.id.split("-").pop()}.jpg`} className="text-brand hover:underline">
          Pobierz
        </a>
      </figcaption>
    </figure>
  );
}

function PhotoTile({ photo }: { photo: Photo }) {
  const url = useMediaUrl(photo.src);
  return (
    <figure className="overflow-hidden rounded-2xl bg-white ring-1 ring-stone-900/5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img src={url} alt={photo.roomName ?? "Zdjęcie"} className="aspect-[4/3] w-full object-cover" /> : <div className="aspect-[4/3] animate-pulse bg-stone-200" />}
      {photo.roomName && <figcaption className="px-3 py-2 text-xs text-stone-600">{photo.roomName}</figcaption>}
    </figure>
  );
}

function Publish({ offer }: { offer: Offer }) {
  const router = useRouter();
  const [copied, setCopied] = useState<string | null>(null);
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const link = `${origin}/o/${offer.slug}`;
  const embed = `<iframe src="${origin}/embed/${offer.slug}" width="100%" height="560" style="border:0;border-radius:16px" allow="fullscreen" title="${offer.title} w 3D"></iframe>`;
  const copy = async (key: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1600);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold">Link do oferty</h2>
        <p className="text-sm text-stone-600">Strona z modelem 3D, filmami i danymi kontaktowymi agenta. Działa na telefonie.</p>
        <div className="flex gap-2">
          <code className="flex-1 truncate rounded-xl bg-stone-50 px-3 py-2.5 text-sm ring-1 ring-stone-900/10">{link}</code>
          <Button onClick={() => copy("link", link)}>{copied === "link" ? "Skopiowano" : "Kopiuj"}</Button>
        </div>
        {!offer.consentOwner && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Brak zgody właściciela na publikację. Zaznacz ją, zanim udostępnisz link.
          </p>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={offer.consentOwner} onChange={(e) => updateOffer(offer.id, (o) => ({ ...o, consentOwner: e.target.checked }))} className="h-4 w-4 accent-[var(--brand)]" />
          Mam zgodę właściciela na publikację zdjęć i wizualizacji
        </label>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold">Otodom, Morizon, Gratka</h2>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-6 text-stone-600">
          <li>Edytuj ogłoszenie i przejdź do sekcji multimediów.</li>
          <li>W polu „wirtualny spacer” wklej link do oferty.</li>
          <li>W galerii dodaj film 16:9 ze spaceru 3D.</li>
        </ol>
        <p className="text-xs text-stone-500">Otodom: ogłoszenia z widokiem 3D mają 2× więcej wyświetleń i o 50% więcej zapytań.</p>
      </Card>

      <Card className="flex flex-col gap-3 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Osadzenie na stronie biura lub w CRM</h2>
          <Button variant="secondary" onClick={() => copy("embed", embed)}>
            {copied === "embed" ? "Skopiowano" : "Kopiuj kod"}
          </Button>
        </div>
        <pre className="overflow-x-auto rounded-xl bg-stone-900 p-4 text-xs leading-5 text-stone-100">{embed}</pre>
      </Card>

      {!offer.sample && (
        <div className="lg:col-span-2">
          <Button
            variant="ghost"
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={async () => {
              if (!confirm("Usunąć ofertę razem ze zdjęciami i filmami?")) return;
              await removeOffer(offer.id);
              router.push("/");
            }}
          >
            Usuń ofertę
          </Button>
        </div>
      )}
    </div>
  );
}
