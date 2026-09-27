import { describe, expect, it } from "vitest";
import { htmlToText, parseGeneric, parseListing, parseOtodom } from "@/lib/import/parse";
import { portalFor } from "@/lib/import/types";
import { presetRooms } from "@/lib/plan/presets";
import { checkArea } from "@/lib/plan/area";

/** Synthetic Otodom page (same structure as the real one, invented data). */
function otodomPage(overrides: Record<string, unknown> = {}) {
  const ad = {
    title: "Słoneczne 3 pokoje z balkonem",
    url: "https://www.otodom.pl/pl/oferta/sloneczne-3-pokoje-ID0TEST",
    description: "<p>Mieszkanie <b>52 m²</b> na 3. piętrze.</p><ul><li>balkon</li><li>piwnica</li></ul><p>Cena&nbsp;do negocjacji &amp; szybki termin.</p>",
    target: {
      Area: "52.5",
      Price: 769000,
      Rooms_num: ["3"],
      Floor_no: ["floor_3"],
      Building_floors_num: "4",
      City: "krakow",
      Extras_types: ["balcony", "basement", "separate_kitchen"],
    },
    location: {
      address: { street: { name: "ul. Testowa", number: "7" } },
      reverseGeocoding: {
        locations: [
          { locationLevel: "voivodeship", name: "małopolskie" },
          { locationLevel: "city_or_village", name: "Kraków" },
          { locationLevel: "district", name: "Prądnik Czerwony" },
        ],
      },
    },
    images: [
      { large: "https://img.example/elewacja.jpg", isExterior: true },
      { large: "https://img.example/salon.jpg", isExterior: false },
      { large: "https://img.example/kuchnia.jpg", isExterior: false },
    ],
    floorPlans: [{ large: "https://img.example/rzut.jpg" }],
    contactDetails: { name: "Jan Testowy", phones: ["+48 500 000 000"] },
    agency: null,
    ...overrides,
  };
  return `<html><head><title>x</title></head><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { ad } } })}</script></body></html>`;
}

describe("Otodom import", () => {
  const l = parseOtodom(otodomPage(), "https://www.otodom.pl/pl/oferta/x")!;

  it("reads price, area, rooms, floor and location", () => {
    expect(l).toMatchObject({
      portal: "Otodom",
      title: "Słoneczne 3 pokoje z balkonem",
      street: "ul. Testowa 7",
      city: "Kraków",
      district: "Prądnik Czerwony",
      area: 52.5,
      price: 769000,
      rooms: 3,
      floor: "3/4",
      balcony: true,
      separateKitchen: true,
      agentName: "Jan Testowy",
      agentPhone: "+48 500 000 000",
    });
  });

  it("puts interior photos first and keeps floor plans separately", () => {
    expect(l.images).toEqual(["https://img.example/salon.jpg", "https://img.example/kuchnia.jpg", "https://img.example/elewacja.jpg"]);
    expect(l.floorPlans).toEqual(["https://img.example/rzut.jpg"]);
  });

  it("turns the description HTML into readable text", () => {
    expect(l.description).toBe("Mieszkanie 52 m² na 3. piętrze.\n• balkon\n• piwnica\n\nCena do negocjacji & szybki termin.");
  });

  it("maps special floors and agency names", () => {
    const g = parseOtodom(otodomPage({ target: { Area: "40", Price: 1, Rooms_num: ["2"], Floor_no: ["ground_floor"], Building_floors_num: "10" }, agency: { name: "Biuro Test" } }), "https://www.otodom.pl/x")!;
    expect(g.floor).toBe("parter/10");
    expect(g.agentName).toBe("Biuro Test");
    expect(g.balcony).toBe(false);
  });

  it("returns null for a page without listing data", () => {
    expect(parseOtodom("<html></html>", "https://www.otodom.pl/x")).toBeNull();
  });
});

describe("other portals (OpenGraph / JSON-LD)", () => {
  it("reads basics from meta tags and text", () => {
    const html = `<meta property="og:title" content="Mieszkanie 3 pokoje, 61,5 m², 845 000 zł"><meta property="og:image" content="https://cdn.example/1.jpg"><meta property="og:description" content="Przestronne mieszkanie z balkonem i oddzielną kuchnią.">`;
    const l = parseGeneric(html, "https://www.morizon.pl/oferta/1", "Morizon")!;
    expect(l).toMatchObject({ area: 61.5, price: 845000, rooms: 3, balcony: true, separateKitchen: true, images: ["https://cdn.example/1.jpg"] });
  });

  it("prefers JSON-LD values when present", () => {
    const ld = { "@type": "Offer", offers: { price: "500000" }, floorSize: { value: 44 }, numberOfRooms: 2, address: { streetAddress: "ul. Przykład 1", addressLocality: "Gdańsk" } };
    const html = `<title>Oferta</title><script type="application/ld+json">${JSON.stringify(ld)}</script>`;
    expect(parseGeneric(html, "https://gratka.pl/o/1", "Gratka")).toMatchObject({ price: 500000, area: 44, rooms: 2, street: "ul. Przykład 1", city: "Gdańsk" });
  });
});

describe("portal allowlist", () => {
  it("accepts supported portals and rejects others", () => {
    expect(portalFor("www.otodom.pl")?.name).toBe("Otodom");
    expect(portalFor("m.olx.pl")?.name).toBe("OLX");
    expect(portalFor("otodom.pl.evil.com")).toBeUndefined();
    expect(parseListing("<html></html>", "https://example.com/x")).toBeNull();
  });
});

describe("room presets", () => {
  it("adds a separate kitchen and still sums to the offer area", () => {
    const rooms = presetRooms(3, 52.5, { separateKitchen: true });
    expect(rooms.map((r) => r.name)).toContain("Kuchnia");
    expect(rooms.find((r) => r.kind === "salon")?.name).toBe("Salon");
    expect(checkArea(rooms, 52.5).ok).toBe(true);
  });

  it("clamps big flats to the largest preset", () => {
    expect(checkArea(presetRooms(6, 120), 120).ok).toBe(true);
  });
});

it("htmlToText decodes numeric entities", () => {
  expect(htmlToText("&#322;azienka &#x105;")).toBe("łazienka ą");
});
