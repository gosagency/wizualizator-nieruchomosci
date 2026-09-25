import type { Plan } from "./types";

/** Sample apartment "Podgórze 58" (3 rooms, 58 m², Kraków), hand-drawn from the reference demo. */
export const PODGORZE_PLAN: Plan = {
  bounds: [-0.1, 9.3, -0.1, 6.4],
  sunFrom: "w",
  rooms: [
    { id: "salon", name: "Salon z aneksem", kind: "salon", area: 20.8, c: [2.6, 2.0], rects: [[0, 5.2, 0, 4.0]], floor: "oak",
      features: ["Aneks kuchenny z oknem", "Przeszklone wyjście na balkon od zachodu", "Stół dla 4 osób"] },
    { id: "syp", name: "Sypialnia", kind: "sypialnia", area: 13.6, c: [7.2, 1.7], rects: [[5.2, 9.2, 0, 3.4]], floor: "oak",
      features: ["Okna na północ i wschód", "Łóżko 160 × 200 cm", "Szafa 2,2 m"] },
    { id: "dz", name: "Pokój dziecięcy", kind: "dzieciecy", area: 8.3, c: [1.8, 5.15], rects: [[0, 3.6, 4.0, 6.3]], floor: "oak",
      features: ["Dwa okna: zachód i południe", "Miejsce na biurko", "Wejście z przedpokoju"] },
    { id: "hol", name: "Przedpokój", kind: "przedpokoj", area: 8.3, c: [5.2, 5.0], rects: [[3.6, 6.8, 4.0, 6.3], [5.2, 6.8, 3.4, 4.0]], floor: "oak",
      features: ["Szafa w zabudowie", "Otwarte przejście do salonu"] },
    { id: "laz", name: "Łazienka", kind: "lazienka", area: 7.0, c: [8.0, 4.85], rects: [[6.8, 9.2, 3.4, 6.3]], floor: "tile",
      features: ["Wanna 170 cm", "Okno", "Miejsce na pralkę"] },
    { id: "bal", name: "Balkon", kind: "balkon", area: 3.1, c: [-0.65, 2.0], rects: [[-1.3, 0, 0.8, 3.2]], floor: "deck", extra: true,
      features: ["Słońce po południu i wieczorem", "Miejsce na stolik i 2 krzesła", "Poza metrażem mieszkania"] },
  ],
  balcony: { rect: [-1.3, -0.1, 0.8, 3.2], attach: "e" },
  walls: [
    { ax: "x", c: 0, a: -0.1, b: 9.3, t: 0.2, op: [{ a: 3.4, b: 4.6, y0: 1.05, y1: 2.3, glass: true }, { a: 6.5, b: 8.1, y0: 0.85, y1: 2.3, glass: true }] },
    { ax: "x", c: 6.3, a: -0.1, b: 9.3, t: 0.2, op: [{ a: 1.0, b: 2.4, y0: 0.85, y1: 2.3, glass: true }, { a: 4.6, b: 5.5, y0: 0, y1: 2.1, door: true }] },
    { ax: "z", c: 0, a: 0.1, b: 6.2, t: 0.2, op: [{ a: 1.0, b: 3.0, y0: 0, y1: 2.3, glass: true }, { a: 4.6, b: 5.8, y0: 0.85, y1: 2.3, glass: true }] },
    { ax: "z", c: 9.2, a: 0.1, b: 6.2, t: 0.2, op: [{ a: 1.0, b: 2.4, y0: 0.85, y1: 2.3, glass: true }, { a: 4.9, b: 5.5, y0: 1.5, y1: 2.1, glass: true }] },
    { ax: "x", c: 4.0, a: 0.1, b: 3.9, t: 0.1, op: [] },
    { ax: "z", c: 3.6, a: 4.05, b: 6.2, t: 0.1, op: [{ a: 4.3, b: 5.1, y0: 0, y1: 2.05 }] },
    { ax: "z", c: 5.2, a: 0.1, b: 3.45, t: 0.1, op: [] },
    { ax: "x", c: 3.4, a: 5.15, b: 9.1, t: 0.1, op: [{ a: 5.4, b: 6.2, y0: 0, y1: 2.05 }] },
    { ax: "z", c: 6.8, a: 3.45, b: 6.2, t: 0.1, op: [{ a: 4.8, b: 5.6, y0: 0, y1: 2.05 }] },
  ],
  furniture: [
    // salon
    { kind: "rug", r: [0.5, 2.9, 1.5, 3.1] },
    { kind: "tvUnit", r: [0.8, 2.6, 0.12, 0.52], face: "s" },
    { kind: "sofa", r: [0.6, 2.8, 3.05, 3.9], face: "n" },
    { kind: "coffeeTable", r: [1.28, 2.12, 1.88, 2.72] },
    { kind: "floorLamp", r: [0.2, 0.5, 3.55, 3.85] },
    { kind: "plant", r: [0.2, 0.5, 0.3, 0.6] },
    { kind: "plant", r: [0.4, 0.7, 2.8, 3.1], h: 0.22 },
    { kind: "diningTable", r: [3.1, 4.5, 1.6, 2.4] },
    { kind: "kitchen", r: [2.3, 5.1, 0.1, 0.7], face: "s" },
    // sypialnia
    { kind: "rug", r: [6.1, 8.5, 0.55, 2.85] },
    { kind: "bed", r: [5.3, 7.4, 0.9, 2.5], face: "e" },
    { kind: "nightstand", r: [5.3, 5.75, 0.35, 0.8] },
    { kind: "nightstand", r: [5.3, 5.75, 2.6, 3.05] },
    { kind: "wardrobe", r: [6.9, 9.1, 2.8, 3.33], face: "n" },
    { kind: "plant", r: [8.7, 9.0, 0.25, 0.55] },
    // pokój dziecięcy
    { kind: "singleBed", r: [0.12, 1.02, 4.15, 6.15], face: "e" },
    { kind: "desk", r: [1.4, 2.6, 5.7, 6.18], face: "n" },
    { kind: "shelf", r: [2.95, 3.52, 4.08, 4.45], face: "s" },
    { kind: "rug", r: [1.4, 2.8, 4.3, 5.5] },
    // przedpokój
    { kind: "wardrobe", r: [5.9, 6.72, 5.6, 6.22], face: "n" },
    { kind: "shelf", r: [3.75, 4.5, 5.8, 6.2], face: "n", h: 0.45 },
    { kind: "rug", r: [4.3, 6.4, 4.3, 5.3] },
    // łazienka
    { kind: "bathtub", r: [7.5, 9.12, 5.45, 6.22] },
    { kind: "sink", r: [8.65, 9.12, 3.7, 4.6], face: "w" },
    { kind: "toilet", r: [7.2, 7.6, 3.48, 4.05], face: "s" },
    { kind: "shelf", r: [6.9, 7.45, 5.6, 6.2], face: "n", h: 0.85 },
    // balkon
    { kind: "outdoorSet", r: [-1.2, -0.2, 1.2, 2.8] },
    { kind: "plant", r: [-1.25, -0.95, 0.85, 1.15], h: 0.26 },
  ],
};
