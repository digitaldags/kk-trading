import type { Category, ProductWithCategory } from "@/lib/domain/types";

// Admin fixtures shaped like the seed data. Ids are uuids, as the shared schema expects.

const at = new Date("2026-01-01T00:00:00Z");

export const OFFICE: Category = {
  id: "00000000-0000-4000-8000-000000000001",
  slug: "office",
  name: "Office equipment",
  icon: "chair",
  blurb: "",
  sortOrder: 0,
  createdAt: at,
  updatedAt: at,
};

export const GYM: Category = {
  ...OFFICE,
  id: "00000000-0000-4000-8000-000000000002",
  slug: "gym",
  name: "Gym equipment",
  icon: "fitness_center",
  sortOrder: 1,
};

export function adminProduct(
  overrides: Partial<Omit<ProductWithCategory, "category">> & {
    category?: Category;
  } = {},
): ProductWithCategory {
  const { category = OFFICE, ...rest } = overrides;
  return {
    id: "00000000-0000-4000-8000-0000000000a1",
    slug: "ergonomic-mesh-chair",
    categoryId: category.id,
    name: "Ergonomic mesh chair",
    priceCentavos: 895000,
    stockStatus: "in_stock",
    keySpec: "Seat height 44–54 cm",
    description: "Breathable mesh back.",
    imageUrl: null,
    imagePathname: null,
    isSample: false,
    sortOrder: 0,
    createdAt: at,
    updatedAt: at,
    ...rest,
    category: {
      id: category.id,
      slug: category.slug,
      name: category.name,
      icon: category.icon,
      sortOrder: category.sortOrder,
    },
  };
}
