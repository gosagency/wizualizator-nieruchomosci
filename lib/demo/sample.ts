import { PODGORZE_PLAN } from "@/lib/plan/podgorze";
import type { Offer, Org } from "./types";

export const DEFAULT_ORG: Org = {
  name: "Twoje Biuro Nieruchomości",
  color: "#1f5c4a",
};

/** Sample listing shown in the demo (fictional agent). Room images are rendered from the 3D model on first use. */
export const SAMPLE_OFFER: Offer = {
  id: "podgorze-58",
  slug: "podgorze-58",
  createdAt: Date.UTC(2026, 8, 24, 10),
  sample: true,
  title: "3 pokoje z balkonem, 58 m²",
  street: "ul. Przykładowa 12",
  city: "Kraków",
  district: "Podgórze",
  area: 58,
  price: 749000,
  floor: "4/6",
  style: "skandynawski",
  description:
    "Jasne, rozkładowe mieszkanie z salonem od zachodu i balkonem. Sypialnia z oknami na dwie strony, osobny pokój dziecięcy, łazienka z oknem.",
  agent: { name: "Anna Nowak", phone: "+48 600 000 000", email: "anna.nowak@example.com" },
  consentOwner: true,
  rooms: PODGORZE_PLAN.rooms.map((r) => ({ name: r.name, kind: r.kind, area: r.area })),
  plan: PODGORZE_PLAN,
  photos: [],
  renders: [],
  videos: [],
};
