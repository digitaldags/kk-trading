import type { StockStatus } from "@/lib/domain/stock";

// The prototype's `<script id="store">` content (docs/reference/prototype.html), with prices in centavos.

export const SEED_SETTINGS = {
  name: "KK Trading",
  headline: "Equipment for the desk and the gym",
  tagline:
    "Office furniture and fitness gear for homes, offices and training spaces.",
  phone: "0917 000 0000",
  email: "hello@example.com",
  address: "Add your store address in Admin, Store details",
};

// Slugs are the prototype's ids, which the storefront uses in `/?category=office`.
export const SEED_CATEGORIES = [
  {
    slug: "office",
    name: "Office equipment",
    icon: "chair",
    blurb: "Chairs, desks, storage and desk accessories",
  },
  {
    slug: "gym",
    name: "Gym equipment",
    icon: "fitness_center",
    blurb: "Bars, benches, racks and free weights",
  },
] as const;

type SeedProduct = {
  category: (typeof SEED_CATEGORIES)[number]["slug"];
  name: string;
  priceCentavos: number;
  stockStatus: StockStatus;
  keySpec: string;
  description: string;
};

export const SEED_PRODUCTS: SeedProduct[] = [
  {
    category: "office",
    name: "Ergonomic mesh chair",
    priceCentavos: 895000,
    stockStatus: "in_stock",
    keySpec: "Seat height 44–54 cm · 3D armrests",
    description:
      "Breathable mesh back with adjustable lumbar support, synchro-tilt and a 5-year frame warranty.",
  },
  {
    category: "office",
    name: "Electric standing desk",
    priceCentavos: 1850000,
    stockStatus: "low_stock",
    keySpec: "140 × 70 cm top · Height 72–118 cm",
    description:
      "Dual-motor frame with four memory presets and anti-collision stop. Supports up to 120 kg.",
  },
  {
    category: "office",
    name: "Steel 4-drawer filing cabinet",
    priceCentavos: 620000,
    stockStatus: "in_stock",
    keySpec: "Legal size · Central lock",
    description:
      "Powder-coated steel with full-extension ball-bearing drawers and an anti-tilt mechanism.",
  },
  {
    category: "office",
    name: "Dual monitor arm",
    priceCentavos: 325000,
    stockStatus: "in_stock",
    keySpec: "Fits 17–32 in screens · VESA 75/100",
    description:
      "Gas-spring arms with cable management, clamp and grommet mounts included.",
  },
  {
    category: "gym",
    name: "Olympic barbell 20 kg",
    priceCentavos: 780000,
    stockStatus: "in_stock",
    keySpec: "2,200 mm · 28 mm grip",
    description:
      "Bearing sleeves, medium knurl with center knurl. Rated for 700 kg static load.",
  },
  {
    category: "gym",
    name: "Adjustable FID bench",
    priceCentavos: 545000,
    stockStatus: "in_stock",
    keySpec: "7 back positions · Max load 300 kg",
    description:
      "Flat, incline and decline settings with a 3-position seat and transport wheels.",
  },
  {
    category: "gym",
    name: "Power rack with J-hooks",
    priceCentavos: 2490000,
    stockStatus: "low_stock",
    keySpec: "Max load 450 kg · 2.1 m tall",
    description:
      "11-gauge steel uprights, numbered holes, spotter arms and a pull-up bar.",
  },
  {
    category: "gym",
    name: "Rubber hex dumbbells, pair",
    priceCentavos: 260000,
    stockStatus: "out_of_stock",
    keySpec: "2 × 10 kg · Chrome handles",
    description: "Hexagonal heads stay put on the floor. Sold as a pair.",
  },
];
