/** Listing data imported from a real estate portal, ready to prefill a new offer. */
export type ImportedListing = {
  source: "otodom" | "inny";
  /** portal name for the UI, e.g. "Otodom" */
  portal: string;
  url: string;
  title: string;
  street: string;
  city: string;
  district: string;
  /** m², 0 when unknown */
  area: number;
  /** PLN, 0 when unknown */
  price: number;
  /** number of rooms, 0 when unknown */
  rooms: number;
  /** e.g. "3/4", "parter/4" */
  floor: string;
  description: string;
  /** full-size photo URLs (interior first) */
  images: string[];
  /** floor plan image URLs, if the listing has them */
  floorPlans: string[];
  agentName: string;
  agentPhone: string;
  balcony: boolean;
  separateKitchen: boolean;
};

export const SUPPORTED_PORTALS: Array<{ host: string; name: string }> = [
  { host: "otodom.pl", name: "Otodom" },
  { host: "morizon.pl", name: "Morizon" },
  { host: "gratka.pl", name: "Gratka" },
  { host: "nieruchomosci-online.pl", name: "Nieruchomości-online" },
  { host: "domiporta.pl", name: "Domiporta" },
  { host: "olx.pl", name: "OLX" },
  { host: "adresowo.pl", name: "Adresowo" },
];

export function portalFor(hostname: string) {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  return SUPPORTED_PORTALS.find((p) => host === p.host || host.endsWith(`.${p.host}`));
}
