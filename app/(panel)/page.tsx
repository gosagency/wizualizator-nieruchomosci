"use client";

import Link from "next/link";
import { ButtonLink, Card, PageHeader, Pill } from "@/components/ui";
import { OfferThumb } from "@/components/OfferThumb";
import { useRoomViews } from "@/lib/demo/roomViews";
import { useHydrated, useOffers, useOrg } from "@/lib/demo/store";
import { formatArea, formatPrice } from "@/lib/plan/area";

/** Market reference prices (docs/RYNEK.md): 3D tour 500–1 500 zł, reel from a videographer 800–3 000 zł. */
const TOUR_PRICE = 900;
const REEL_PRICE = 1500;

export default function Dashboard() {
  const hydrated = useHydrated();
  const offers = useOffers();
  const org = useOrg();
  useRoomViews(hydrated ? offers : []);
  const videos = offers.reduce((n, o) => n + o.videos.length, 0);
  const savings = offers.reduce((sum, o) => sum + TOUR_PRICE + (o.videos.length ? REEL_PRICE : 0), 0);

  return (
    <>
      <PageHeader
        title="Oferty"
        subtitle={`Panel oddziału · ${org.name}`}
        actions={<ButtonLink href="/oferty/nowa">+ Nowa oferta</ButtonLink>}
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Oferty" value={hydrated ? offers.length : "–"} />
        <Stat label="Modele 3D" value={hydrated ? offers.length : "–"} hint="każda oferta ma model" />
        <Stat label="Filmy" value={hydrated ? videos : "–"} hint="spacer 3D i rolki" />
        <Stat
          label="Oszczędność vs zlecenia"
          value={hydrated ? formatPrice(savings) : "–"}
          hint={`szacunek: spacer 3D ~${TOUR_PRICE} zł i rolka ~${REEL_PRICE} zł na ofertę`}
          accent
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {offers.map((o) => (
          <Link key={o.id} href={`/oferty/${o.id}`} className="group overflow-hidden rounded-3xl bg-white ring-1 ring-stone-900/5 transition hover:-translate-y-0.5 hover:shadow-lg">
            <div className="relative aspect-[4/3] overflow-hidden">
              <OfferThumb offer={o} className="h-full w-full transition duration-500 group-hover:scale-[1.03]" />
              {o.sample && (
                <span className="absolute left-3 top-3">
                  <Pill tone="amber">Oferta przykładowa</Pill>
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2 p-5">
              <p className="text-xs text-stone-500">
                {[o.district, o.city].filter(Boolean).join(", ")}
              </p>
              <h2 className="font-semibold leading-snug">{o.title}</h2>
              <p className="text-sm text-stone-600">
                <span className="font-semibold text-stone-900">{formatPrice(o.price)}</span> · {formatArea(o.area)}
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Pill tone="brand">Model 3D</Pill>
                {o.videos.length > 0 && <Pill>{o.videos.length} {o.videos.length === 1 ? "film" : o.videos.length < 5 ? "filmy" : "filmów"}</Pill>}
                {o.renders.length > 0 && <Pill>Wizualizacje pokoi</Pill>}
                {o.photos.length > 0 && <Pill>{o.photos.length} zdj.</Pill>}
              </div>
            </div>
          </Link>
        ))}
        <Link
          href="/oferty/nowa"
          className="flex min-h-[280px] flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-stone-300 p-6 text-center text-stone-500 transition hover:border-brand hover:text-brand"
        >
          <span className="text-3xl">+</span>
          <span className="font-medium">Dodaj ofertę</span>
          <span className="text-xs">Zdjęcia i metraż pokoi wystarczą</span>
        </Link>
      </section>

      <Card className="grid gap-6 sm:grid-cols-3">
        {[
          ["1", "Dane i zdjęcia", "Agent wpisuje metraż pokoi i wgrywa zdjęcia z telefonu. Bez rysowania."],
          ["2", "Model 3D i filmy", "Aplikacja sama układa rzut, buduje model 3D i nagrywa spacer oraz rolkę do social mediów."],
          ["3", "Link do ogłoszenia", "Jeden link z modelem, filmami i brandingiem biura: do Otodom, na stronę biura i do CRM."],
        ].map(([n, t, d]) => (
          <div key={n} className="flex gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">{n}</span>
            <div>
              <h3 className="font-semibold">{t}</h3>
              <p className="mt-1 text-sm leading-6 text-stone-600">{d}</p>
            </div>
          </div>
        ))}
      </Card>
    </>
  );
}

function Stat({ label, value, hint, accent }: { label: string; value: string | number; hint?: string; accent?: boolean }) {
  return (
    <div className={`rounded-3xl p-5 sm:p-6 ${accent ? "bg-brand text-white" : "bg-white ring-1 ring-stone-900/5"}`}>
      <p className={`text-xs ${accent ? "text-white/75" : "text-stone-500"}`}>{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className={`mt-1 text-xs ${accent ? "text-white/70" : "text-stone-400"}`}>{hint}</p>}
    </div>
  );
}
