"use client";

import { useState } from "react";
import { OrgMark } from "@/components/OrgMark";
import { Button, Card, Field, Input, PageHeader } from "@/components/ui";
import { resetDemo, saveOrg, useHydrated, useOrg } from "@/lib/demo/store";

const COLORS = ["#1f5c4a", "#1e3a8a", "#7c2d12", "#b91c1c", "#0f766e", "#6d28d9", "#1c1917", "#b45309"];

/** Downscales an uploaded logo to a small PNG data URL. */
async function logoDataUrl(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const h = 96;
  const w = Math.round((bmp.width / bmp.height) * h);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  return c.toDataURL("image/png");
}

export default function Settings() {
  const hydrated = useHydrated();
  const org = useOrg();
  const [saved, setSaved] = useState(false);
  if (!hydrated) return null;

  const update = (patch: Partial<typeof org>) => {
    saveOrg({ ...org, ...patch });
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  };

  return (
    <>
      <PageHeader title="Ustawienia" subtitle={saved ? "Zapisano" : "Branding biura na stronach ofert i w filmach"} />

      <Card className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="flex flex-col gap-4">
          <h2 className="font-semibold">Branding</h2>
          <Field label="Nazwa biura / oddziału">
            <Input value={org.name} onChange={(e) => update({ name: e.target.value })} />
          </Field>
          <Field label="Kolor marki">
            <div className="flex flex-wrap items-center gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Kolor ${c}`}
                  onClick={() => update({ color: c })}
                  className={`h-9 w-9 rounded-full ring-offset-2 transition ${org.color === c ? "ring-2 ring-stone-900" : ""}`}
                  style={{ background: c }}
                />
              ))}
              <input type="color" value={org.color} onChange={(e) => update({ color: e.target.value })} aria-label="Własny kolor" className="h-9 w-12 cursor-pointer rounded-lg" />
            </div>
          </Field>
          <Field label="Logo" hint="PNG lub SVG, najlepiej na przezroczystym tle">
            <div className="flex items-center gap-3">
              <input type="file" accept="image/*" onChange={async (e) => e.target.files?.[0] && update({ logo: await logoDataUrl(e.target.files[0]) })} className="text-sm" />
              {org.logo && (
                <Button variant="ghost" onClick={() => update({ logo: undefined })}>
                  Usuń logo
                </Button>
              )}
            </div>
          </Field>
        </div>
        <div className="flex flex-col gap-3 rounded-2xl bg-stone-50 p-4">
          <p className="text-xs text-stone-500">Podgląd na stronie oferty</p>
          <div className="flex items-center gap-2.5">
            <OrgMark org={org} size={36} />
            <span className="font-semibold">{org.name}</span>
          </div>
          <span className="w-fit rounded-full px-4 py-2 text-sm font-medium text-white" style={{ background: org.color }}>
            Umów oglądanie
          </span>
        </div>
      </Card>

      <Card className="flex flex-col items-start gap-3">
        <h2 className="font-semibold">Dane demonstracyjne</h2>
        <p className="text-sm text-stone-600">Przywraca ofertę przykładową i domyślny branding. Usuwa oferty dodane w tej przeglądarce.</p>
        <Button
          variant="secondary"
          onClick={() => {
            if (confirm("Przywrócić dane demonstracyjne?")) resetDemo();
          }}
        >
          Przywróć dane demo
        </Button>
      </Card>
    </>
  );
}
