/**
 * Apartment plan in metres. X = east, Z = south, (0,0) = north-west corner.
 * Same format as docs/reference/demo-3d-podgorze.html (skill model-3d-z-rzutu).
 */

export type RoomKind =
  | "salon"
  | "kuchnia"
  | "sypialnia"
  | "pokoj"
  | "dzieciecy"
  | "gabinet"
  | "lazienka"
  | "wc"
  | "przedpokoj"
  | "balkon";

export type FloorType = "oak" | "tile" | "deck";

/** [x0, x1, z0, z1] */
export type Rect = [number, number, number, number];

export type Room = {
  id: string;
  name: string;
  kind: RoomKind;
  /** m², as entered by the agent */
  area: number;
  rects: Rect[];
  /** label / camera focus point [x, z] */
  c: [number, number];
  floor: FloorType;
  features: string[];
  /** outside the apartment area (balcony) */
  extra?: boolean;
};

export type Opening = {
  a: number;
  b: number;
  y0: number;
  y1: number;
  /** glazed (window or balcony door) */
  glass?: boolean;
  /** solid entrance door */
  door?: boolean;
};

export type Wall = {
  /** "x": runs along X at z = c; "z": runs along Z at x = c */
  ax: "x" | "z";
  c: number;
  a: number;
  b: number;
  /** thickness: 0.2 exterior, 0.1 interior */
  t: number;
  op: Opening[];
};

export type FurnitureItem = {
  kind:
    | "bed"
    | "singleBed"
    | "nightstand"
    | "wardrobe"
    | "sofa"
    | "coffeeTable"
    | "tvUnit"
    | "rug"
    | "diningTable"
    | "kitchen"
    | "desk"
    | "shelf"
    | "bathtub"
    | "sink"
    | "toilet"
    | "plant"
    | "floorLamp"
    | "outdoorSet";
  /** footprint [x0, x1, z0, z1] */
  r: Rect;
  /** which side of the footprint faces into the room: n/s/e/w */
  face?: "n" | "s" | "e" | "w";
  /** optional height override in metres */
  h?: number;
};

export type Balcony = {
  rect: Rect;
  /** side of the balcony that touches the building */
  attach: "n" | "s" | "e" | "w";
};

export type Plan = {
  rooms: Room[];
  walls: Wall[];
  /** building slab [x0, x1, z0, z1] (without balcony) */
  bounds: Rect;
  balcony?: Balcony;
  furniture: FurnitureItem[];
  /** orientation hint for the sun: side the main windows face */
  sunFrom?: "n" | "s" | "e" | "w";
};

export const ROOM_KIND_LABELS: Record<RoomKind, string> = {
  salon: "Salon",
  kuchnia: "Kuchnia",
  sypialnia: "Sypialnia",
  pokoj: "Pokój",
  dzieciecy: "Pokój dziecięcy",
  gabinet: "Gabinet",
  lazienka: "Łazienka",
  wc: "WC",
  przedpokoj: "Przedpokój",
  balkon: "Balkon",
};

export function floorFor(kind: RoomKind): FloorType {
  if (kind === "lazienka" || kind === "wc") return "tile";
  if (kind === "balkon") return "deck";
  return "oak";
}
