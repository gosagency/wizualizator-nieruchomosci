import type { Metadata } from "next";
import { Card, PageHeader, Pill } from "@/components/ui";

export const metadata: Metadata = { title: "Integracje · Wizualizator nieruchomości" };

const ITEMS: Array<{ title: string; status: "gotowe" | "w przygotowaniu"; text: string; how: string[] }> = [
  {
    title: "Portale: Otodom, Morizon, Gratka",
    status: "gotowe",
    text: "Link do oferty 3D trafia w pole wirtualnego spaceru, film 16:9 do galerii.",
    how: ["Link /o/… z każdej oferty", "Film MP4 16:9 do pobrania", "Działa z każdym portalem, który przyjmuje link do spaceru"],
  },
  {
    title: "Strona biura",
    status: "gotowe",
    text: "Model 3D osadzony na stronie biura jednym kodem, w kolorach i z logo biura.",
    how: ["Kod <iframe> z zakładki Publikacja", "Wersja mobilna od 390 px", "Znak „Wizualizacja poglądowa” zawsze widoczny"],
  },
  {
    title: "Social media",
    status: "gotowe",
    text: "Rolki 9:16 na Instagram, Facebook, TikTok i YouTube Shorts, z ceną, metrażem i kontaktem do agenta.",
    how: ["Spacer 3D 9:16", "Rolka ze zdjęć 9:16", "Pliki MP4 do pobrania"],
  },
  {
    title: "Systemy CRM biura (np. ASARI, EstiCRM, Galactica Virgo)",
    status: "w przygotowaniu",
    text: "Import oferty z CRM i odesłanie linku 3D oraz filmów z powrotem, bez przepisywania danych.",
    how: ["API REST: utworzenie oferty z danych CRM", "Webhook: gotowy model i filmy", "Pojedyncze logowanie dla agentów oddziału"],
  },
  {
    title: "Pliki do pobrania",
    status: "gotowe",
    text: "Filmy MP4 i wizualizacje JPG do wykorzystania w dowolnym miejscu: druk, prezentacje, mailing.",
    how: ["Filmy 9:16 i 16:9", "Wizualizacje pokoi: stan deweloperski i umeblowane", "Bez opłat za generowanie i bez zewnętrznych usług"],
  },
];

export default function Integrations() {
  return (
    <>
      <PageHeader title="Integracje" subtitle="Jak aplikacja łączy się z narzędziami, których biuro już używa" />
      <div className="grid gap-4 md:grid-cols-2">
        {ITEMS.map((it) => (
          <Card key={it.title} className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-semibold leading-snug">{it.title}</h2>
              <Pill tone={it.status === "gotowe" ? "brand" : "amber"}>{it.status}</Pill>
            </div>
            <p className="text-sm leading-6 text-stone-600">{it.text}</p>
            <ul className="mt-auto space-y-1 text-sm text-stone-700">
              {it.how.map((h) => (
                <li key={h} className="flex gap-2">
                  <span className="text-brand">✓</span>
                  {h}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </>
  );
}
