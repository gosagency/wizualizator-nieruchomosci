import { portalFor, type ImportedListing } from "./types";

/*
 * Turns the HTML of a listing page into ImportedListing.
 * Otodom: full data from the page's embedded Next.js JSON (__NEXT_DATA__).
 * Other portals: OpenGraph / schema.org JSON-LD plus simple text patterns.
 * Pure functions (no network), unit-tested with synthetic pages.
 */

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", oacute: "ó", ndash: "–", mdash: "—", bull: "•" };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") return String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Listing description HTML → plain text with paragraphs and bullet points. */
export function htmlToText(html: string): string {
  const text = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "• ")
    .replace(/<\/\s*(p|div|li|h\d|ul|ol)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  return decodeEntities(text)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

const FLOORS: Record<string, string> = { ground_floor: "parter", cellar: "suterena", garret: "poddasze", floor_higher_10: ">10" };

function floorLabel(floorNo?: string, total?: string | number): string {
  if (!floorNo) return total ? `?/${total}` : "";
  const f = FLOORS[floorNo] ?? floorNo.replace(/^floor_/, "");
  return total ? `${f}/${total}` : f;
}

const first = <T,>(v: T | T[] | undefined): T | undefined => (Array.isArray(v) ? v[0] : v);
const num = (v: unknown) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

type OtodomAd = {
  title?: string;
  description?: string;
  url?: string;
  target?: Record<string, unknown>;
  location?: {
    address?: { street?: { name?: string; number?: string | null } | null } | null;
    reverseGeocoding?: { locations?: Array<{ locationLevel?: string; name?: string }> } | null;
  };
  images?: Array<{ large?: string; medium?: string; isExterior?: boolean }>;
  floorPlans?: Array<{ large?: string; medium?: string }> | null;
  contactDetails?: { name?: string; phones?: string[] } | null;
  agency?: { name?: string } | null;
};

export function parseOtodom(html: string, url: string): ImportedListing | null {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  let ad: OtodomAd | undefined;
  try {
    ad = JSON.parse(m[1])?.props?.pageProps?.ad;
  } catch {
    return null;
  }
  if (!ad?.target) return null;
  const t = ad.target;
  const locs = ad.location?.reverseGeocoding?.locations ?? [];
  const byLevel = (level: string) => locs.find((l) => l.locationLevel === level)?.name ?? "";
  const street = ad.location?.address?.street;
  const extras = (t.Extras_types as string[] | undefined) ?? [];
  const images = [...(ad.images ?? [])].sort((a, b) => Number(!!a.isExterior) - Number(!!b.isExterior)).map((i) => i.large ?? i.medium).filter((s): s is string => !!s);
  return {
    source: "otodom",
    portal: "Otodom",
    url: ad.url ?? url,
    title: ad.title?.trim() ?? "",
    street: [street?.name, street?.number].filter(Boolean).join(" "),
    city: byLevel("city_or_village") || String(t.City ?? ""),
    district: byLevel("district"),
    area: num(t.Area),
    price: num(t.Price),
    rooms: num(first(t.Rooms_num as string[] | string)),
    floor: floorLabel(first(t.Floor_no as string[] | string), t.Building_floors_num as string | undefined),
    description: htmlToText(ad.description ?? ""),
    images,
    floorPlans: (ad.floorPlans ?? []).map((p) => p.large ?? p.medium).filter((s): s is string => !!s),
    agentName: ad.agency?.name || ad.contactDetails?.name || "",
    agentPhone: ad.contactDetails?.phones?.[0] ?? "",
    balcony: extras.some((e) => e === "balcony" || e === "terrace" || e === "loggia"),
    separateKitchen: extras.includes("separate_kitchen"),
  };
}

function meta(html: string, prop: string): string {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  const content = tag?.match(/content=["']([^"']*)["']/i)?.[1];
  return content ? decodeEntities(content).trim() : "";
}

type JsonLd = Record<string, unknown>;

function jsonLd(html: string): JsonLd[] {
  const out: JsonLd[] = [];
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const v = JSON.parse(m[1]);
      const list = Array.isArray(v) ? v : v?.["@graph"] ?? [v];
      for (const item of list) if (item && typeof item === "object") out.push(item as JsonLd);
    } catch {
      // ignore malformed blocks
    }
  }
  return out;
}

/** Fallback for other portals: OpenGraph + JSON-LD + patterns like "52 m²", "3 pokoje", "749 000 zł". */
export function parseGeneric(html: string, url: string, portal: string): ImportedListing | null {
  const ld = jsonLd(html);
  const pick = <T,>(fn: (o: JsonLd) => T | undefined): T | undefined => {
    for (const o of ld) {
      const v = fn(o);
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return undefined;
  };
  const title = meta(html, "og:title") || decodeEntities(html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? "").trim();
  const description = meta(html, "og:description") || meta(html, "description");
  const text = `${title} ${description}`;
  const offers = (o: JsonLd) => (o.offers ?? {}) as Record<string, unknown>;
  const address = (o: JsonLd) => (o.address ?? (o.itemOffered as JsonLd | undefined)?.address) as Record<string, string> | undefined;

  const priceLd = pick((o) => num(offers(o).price) || undefined);
  const priceText = num(text.match(/(\d[\d\s.]{3,})\s*(?:zł|PLN)/i)?.[1]?.replace(/[\s.]/g, ""));
  const areaLd = pick((o) => num((o.floorSize as Record<string, unknown> | undefined)?.value) || undefined);
  const areaText = num(text.match(/(\d+(?:[.,]\d+)?)\s*(?:m²|m2|mkw)/i)?.[1]);
  const roomsLd = pick((o) => num(o.numberOfRooms) || undefined);
  const roomsText = num(text.match(/(\d+)\s*[-‑]?\s*pok/i)?.[1]);
  const images = [meta(html, "og:image"), ...ld.flatMap((o) => (Array.isArray(o.image) ? o.image : o.image ? [o.image] : [])).map((i) => (typeof i === "string" ? i : String((i as Record<string, unknown>).url ?? "")))]
    .filter((s) => /^https?:\/\//.test(s))
    .filter((s, i, a) => a.indexOf(s) === i);

  if (!title && !images.length) return null;
  return {
    source: "inny",
    portal,
    url,
    title,
    street: pick((o) => address(o)?.streetAddress) ?? "",
    city: pick((o) => address(o)?.addressLocality) ?? "",
    district: "",
    area: areaLd ?? areaText,
    price: priceLd ?? priceText,
    rooms: roomsLd ?? roomsText,
    floor: "",
    description,
    images,
    floorPlans: [],
    agentName: "",
    agentPhone: "",
    balcony: /balkon|taras|loggi/i.test(text),
    separateKitchen: /(oddzieln|osobn)\p{L}* kuchni/iu.test(text),
  };
}

export function parseListing(html: string, url: string): ImportedListing | null {
  const portal = portalFor(new URL(url).hostname);
  if (!portal) return null;
  if (portal.host === "otodom.pl") return parseOtodom(html, url) ?? parseGeneric(html, url, portal.name);
  return parseGeneric(html, url, portal.name);
}
