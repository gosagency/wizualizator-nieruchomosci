"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button, Card, Field, Input, PageHeader, Select } from "@/components/ui";
import { compressImage, putBlob } from "@/lib/demo/blobs";
import { saveOffer, slugify } from "@/lib/demo/store";
import { STYLE_LABELS, type Offer, type Photo, type Style } from "@/lib/demo/types";
import { autoLayout, type RoomInput } from "@/lib/plan/autoLayout";
import { checkArea, formatArea, round1 } from "@/lib/plan/area";
import { ROOM_KIND_LABELS, type RoomKind } from "@/lib/plan/types";

const ApartmentViewer = dynamic(() => import("@/components/model3d/ApartmentViewer"), {
  ssr: false,
  loading: () => <div className="h-[62vh] min-h-[380px] animate-pulse rounded-3xl bg-stone-200/60" />,
});

const STEPS = ["Dane", "Pomieszczenia", "Zdjęcia", "Model 3D"];

/** Typical split of the usable area, by number of rooms. */
const PRESETS: Record<number, Array<[string, RoomKind, number]>> = {
  1: [["Pokój z aneksem", "salon", 0.66], ["Łazienka", "lazienka", 0.16], ["Przedpokój", "przedpokoj", 0.18]],
  2: [["Salon z aneksem", "salon", 0.45], ["Sypialnia", "sypialnia", 0.27], ["Łazienka", "lazienka", 0.12], ["Przedpokój", "przedpokoj", 0.16]],
  3: [["Salon z aneksem", "salon", 0.36], ["Sypialnia", "sypialnia", 0.22], ["Pokój", "pokoj", 0.15], ["Łazienka", "lazienka", 0.11], ["Przedpokój", "przedpokoj", 0.16]],
  4: [["Salon z aneksem", "salon", 0.3], ["Sypialnia", "sypialnia", 0.17], ["Pokój", "pokoj", 0.13], ["Pokój dziecięcy", "dzieciecy", 0.12], ["Łazienka", "lazienka", 0.09], ["WC", "wc", 0.03], ["Przedpokój", "przedpokoj", 0.16]],
};

function presetRooms(count: number, area: number): RoomInput[] {
  const rows = PRESETS[count];
  const rooms = rows.map(([name, kind, share]) => ({ name, kind, area: round1(area * share) }));
  const diff = round1(area - rooms.reduce((s, r) => s + r.area, 0));
  const hall = rooms.find((r) => r.kind === "przedpokoj")!;
  hall.area = round1(hall.area + diff);
  return rooms;
}

type PendingPhoto = { id: string; file: File; url: string; roomName: string };

export default function NewOffer() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState({
    street: "",
    city: "Kraków",
    district: "",
    area: 52,
    price: 690000,
    floor: "2/4",
    style: "skandynawski" as Style,
    agentName: "",
    agentPhone: "",
    description: "",
  });
  const [roomCount, setRoomCount] = useState(2);
  const [rooms, setRooms] = useState<RoomInput[]>(() => presetRooms(2, 52));
  const [balcony, setBalcony] = useState(4);
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [consent, setConsent] = useState(false);

  const areaCheck = checkArea(rooms, data.area);
  const allRooms = useMemo<RoomInput[]>(() => (balcony > 0 ? [...rooms, { name: "Balkon", kind: "balkon", area: balcony }] : rooms), [rooms, balcony]);
  const plan = useMemo(() => (step === 3 ? autoLayout(allRooms) : null), [step, allRooms]);
  const title = `${roomCount === 1 ? "Kawalerka" : `${roomCount} pokoje`}${balcony > 0 ? " z balkonem" : ""}, ${formatArea(data.area).replace(",0", "")}`;

  const canNext = [
    data.city.trim() !== "" && data.area > 10 && data.price > 0,
    areaCheck.ok && rooms.every((r) => r.area > 0 && r.name.trim()),
    true,
    true,
  ][step];

  const set = <K extends keyof typeof data>(k: K, v: (typeof data)[K]) => setData((d) => ({ ...d, [k]: v }));

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const defaults = rooms.filter((r) => r.kind !== "przedpokoj").map((r) => r.name);
    setPhotos((ps) => [
      ...ps,
      ...Array.from(files).map((file, i) => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file), roomName: defaults[(ps.length + i) % defaults.length] ?? "" })),
    ]);
  };

  const finish = async () => {
    setSaving(true);
    const id = crypto.randomUUID().slice(0, 8);
    const stored: Photo[] = await Promise.all(
      photos.map(async (p) => ({ id: p.id, roomName: p.roomName || undefined, src: await putBlob(await compressImage(p.file)) })),
    );
    const offer: Offer = {
      id,
      slug: `${slugify(`${title} ${data.district || data.city}`)}-${id.slice(0, 4)}`,
      createdAt: Date.now(),
      title,
      street: data.street,
      city: data.city,
      district: data.district,
      area: data.area,
      price: data.price,
      floor: data.floor,
      style: data.style,
      description: data.description,
      agent: { name: data.agentName || "Agent biura", phone: data.agentPhone || "", email: "" },
      consentOwner: consent,
      rooms: allRooms,
      plan: plan ?? autoLayout(allRooms),
      photos: stored,
      renders: [],
      videos: [],
    };
    saveOffer(offer);
    photos.forEach((p) => URL.revokeObjectURL(p.url));
    router.push(`/oferty/${id}`);
  };

  return (
    <>
      <PageHeader title="Nowa oferta" subtitle="Zdjęcia i metraż pokoi wystarczą. Rzut i model 3D aplikacja zrobi sama." />

      <ol className="grid grid-cols-4 gap-2">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-col gap-1.5">
            <div className={`h-1.5 rounded-full ${i <= step ? "bg-brand" : "bg-stone-200"}`} />
            <span className={`text-xs sm:text-sm ${i === step ? "font-semibold text-stone-900" : "text-stone-500"}`}>
              {i + 1}. {s}
            </span>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <Card className="grid gap-4 sm:grid-cols-2">
          <Field label="Ulica i numer">
            <Input value={data.street} onChange={(e) => set("street", e.target.value)} placeholder="ul. Lipowa 5" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Miasto">
              <Input value={data.city} onChange={(e) => set("city", e.target.value)} />
            </Field>
            <Field label="Dzielnica">
              <Input value={data.district} onChange={(e) => set("district", e.target.value)} placeholder="np. Krowodrza" />
            </Field>
          </div>
          <Field label="Metraż (m²)">
            <Input
              type="number"
              min={10}
              step={0.1}
              value={data.area}
              onChange={(e) => {
                const a = Number(e.target.value);
                set("area", a);
                if (a > 10) setRooms(presetRooms(roomCount, a));
              }}
            />
          </Field>
          <Field label="Cena (zł)" hint={data.area > 0 ? `${Math.round(data.price / data.area).toLocaleString("pl-PL")} zł/m²` : undefined}>
            <Input type="number" min={0} step={1000} value={data.price} onChange={(e) => set("price", Number(e.target.value))} />
          </Field>
          <Field label="Liczba pokoi">
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setRoomCount(n);
                    setRooms(presetRooms(n, data.area));
                  }}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-medium ring-1 transition ${roomCount === n ? "bg-brand text-white ring-brand" : "bg-stone-50 ring-stone-900/10 hover:bg-white"}`}
                >
                  {n === 1 ? "Kawalerka" : n}
                </button>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Piętro">
              <Input value={data.floor} onChange={(e) => set("floor", e.target.value)} placeholder="2/4" />
            </Field>
            <Field label="Styl aranżacji">
              <Select value={data.style} onChange={(e) => set("style", e.target.value as Style)}>
                {Object.entries(STYLE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Agent prowadzący">
            <Input value={data.agentName} onChange={(e) => set("agentName", e.target.value)} placeholder="Imię i nazwisko" />
          </Field>
          <Field label="Telefon agenta">
            <Input value={data.agentPhone} onChange={(e) => set("agentPhone", e.target.value)} placeholder="+48 …" />
          </Field>
          <Field label="Opis (opcjonalnie)" className="sm:col-span-2">
            <textarea value={data.description} onChange={(e) => set("description", e.target.value)} rows={3} className="w-full rounded-xl bg-stone-50 px-3 py-2.5 text-sm ring-1 ring-stone-900/10 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand" />
          </Field>
        </Card>
      )}

      {step === 1 && (
        <Card className="flex flex-col gap-4">
          <p className="text-sm text-stone-600">
            Podaliśmy typowy podział metrażu. Popraw metraż pokoi według rzutu lub pomiaru. Suma musi się zgadzać z metrażem oferty (±0,5 m²).
          </p>
          <div className="flex flex-col gap-2">
            {rooms.map((r, i) => (
              <div key={i} className="grid grid-cols-[1fr_110px_36px] gap-2 sm:grid-cols-[1fr_180px_120px_36px]">
                <Input value={r.name} onChange={(e) => setRooms((rs) => rs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} aria-label="Nazwa pomieszczenia" />
                <Select
                  value={r.kind}
                  onChange={(e) => setRooms((rs) => rs.map((x, j) => (j === i ? { ...x, kind: e.target.value as RoomKind } : x)))}
                  className="hidden sm:block"
                  aria-label="Rodzaj"
                >
                  {Object.entries(ROOM_KIND_LABELS)
                    .filter(([k]) => k !== "balkon")
                    .map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                </Select>
                <div className="relative">
                  <Input type="number" step={0.1} min={0} value={r.area} onChange={(e) => setRooms((rs) => rs.map((x, j) => (j === i ? { ...x, area: Number(e.target.value) } : x)))} aria-label="Metraż" className="pr-9" />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400">m²</span>
                </div>
                <button type="button" aria-label="Usuń pomieszczenie" onClick={() => setRooms((rs) => rs.filter((_, j) => j !== i))} className="rounded-xl text-stone-400 hover:bg-red-50 hover:text-red-600">
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={() => setRooms((rs) => [...rs, { name: "Pokój", kind: "pokoj", area: 8 }])}>
              + Pomieszczenie
            </Button>
            <label className="flex items-center gap-2 text-sm">
              Balkon
              <span className="w-24">
                <Input type="number" step={0.1} min={0} value={balcony} onChange={(e) => setBalcony(Number(e.target.value))} aria-label="Metraż balkonu" />
              </span>
              <span className="text-stone-500">m² (poza metrażem)</span>
            </label>
          </div>
          <div className={`rounded-xl px-4 py-3 text-sm ${areaCheck.ok ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
            Suma pomieszczeń: <b>{formatArea(areaCheck.sum)}</b> z {formatArea(data.area)}
            {areaCheck.ok ? " · zgadza się" : ` · różnica ${formatArea(Math.abs(areaCheck.diff))}, popraw metraż`}
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card className="flex flex-col gap-4">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-stone-300 px-6 py-10 text-center transition hover:border-brand">
            <span className="text-3xl">📷</span>
            <span className="font-medium">Dodaj zdjęcia z telefonu lub komputera</span>
            <span className="text-xs text-stone-500">3–6 na pomieszczenie. Zmniejszamy je automatycznie do 2500 px.</span>
            <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => addFiles(e.target.files)} />
          </label>
          {photos.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {photos.map((p) => (
                <figure key={p.id} className="overflow-hidden rounded-2xl bg-white ring-1 ring-stone-900/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="" className="aspect-[4/3] w-full object-cover" />
                  <figcaption className="flex gap-1 p-2">
                    <Select value={p.roomName} onChange={(e) => setPhotos((ps) => ps.map((x) => (x.id === p.id ? { ...x, roomName: e.target.value } : x)))} className="py-1.5 text-xs" aria-label="Pomieszczenie">
                      {allRooms.map((r) => (
                        <option key={r.name} value={r.name}>
                          {r.name}
                        </option>
                      ))}
                    </Select>
                    <button type="button" aria-label="Usuń zdjęcie" onClick={() => setPhotos((ps) => ps.filter((x) => x.id !== p.id))} className="rounded-lg px-2 text-stone-400 hover:text-red-600">
                      ✕
                    </button>
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--brand)]" />
            Mam zgodę właściciela nieruchomości na publikację zdjęć i wizualizacji.
          </label>
          <p className="text-xs text-stone-500">Możesz pominąć zdjęcia: model 3D i spacer 3D powstaną z samego metrażu.</p>
        </Card>
      )}

      {step === 3 && plan && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-stone-600">
            Rzut ułożony automatycznie z metrażu pokoi. Model jest poglądowy: pokazuje układ i proporcje, nie zastępuje inwentaryzacji.
          </p>
          <ApartmentViewer plan={plan} />
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => (step === 0 ? router.push("/") : setStep(step - 1))}>
          {step === 0 ? "Anuluj" : "← Wstecz"}
        </Button>
        {step < 3 ? (
          <Button onClick={() => setStep(step + 1)} disabled={!canNext}>
            Dalej →
          </Button>
        ) : (
          <Button onClick={finish} disabled={saving}>
            {saving ? "Zapisywanie…" : "Zapisz ofertę"}
          </Button>
        )}
      </div>
    </>
  );
}
