import type {
  CategoryWithCount,
  ProductWithCategory,
  StoreSettings,
} from "@/lib/domain/types";

// Storefront fixtures shaped like the seed data.

const at = new Date("2026-01-01T00:00:00Z");

export const SETTINGS: Omit<StoreSettings, "updatedAt"> = {
  name: "KK Trading",
  headline: "Equipment for the desk and the gym",
  tagline: "Office furniture and fitness gear.",
  phone: "0917 000 0000",
  email: "hello@example.com",
  address: "",
};

export const OFFICE: CategoryWithCount = {
  id: "c-office",
  slug: "office",
  name: "Office equipment",
  icon: "chair",
  blurb: "Chairs, desks and storage",
  sortOrder: 0,
  productCount: 1,
  createdAt: at,
  updatedAt: at,
};

export const GYM: CategoryWithCount = {
  ...OFFICE,
  id: "c-gym",
  slug: "gym",
  name: "Gym equipment",
  icon: "fitness_center",
  blurb: "Bars and benches",
  sortOrder: 1,
  productCount: 2,
};

function product(
  id: string,
  name: string,
  category: CategoryWithCount,
): ProductWithCategory {
  return {
    id,
    slug: id,
    categoryId: category.id,
    name,
    priceCentavos: 895000,
    stockStatus: "in_stock",
    keySpec: "",
    description: "",
    imageUrl: null,
    imagePathname: null,
    isSample: true,
    sortOrder: 0,
    createdAt: at,
    updatedAt: at,
    category: {
      id: category.id,
      slug: category.slug,
      name: category.name,
      icon: category.icon,
      sortOrder: category.sortOrder,
    },
  };
}

export const CHAIR = product("chair", "Ergonomic mesh chair", OFFICE);
export const BENCH = product("bench", "Adjustable FID bench", GYM);
export const BARBELL = product("barbell", "Olympic barbell 20 kg", GYM);

/** Out of stock, with a key spec and a description typed on two lines. */
export const DUMBBELLS: ProductWithCategory = {
  ...product("rubber-hex-dumbbells-pair", "Rubber hex dumbbells, pair", GYM),
  priceCentavos: 260000,
  stockStatus: "out_of_stock",
  keySpec: "2 × 10 kg · Chrome handles",
  description: "Hexagonal heads stay put on the floor.\nSold as a pair.",
};
