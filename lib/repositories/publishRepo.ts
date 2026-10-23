import { eq } from "drizzle-orm";
import { atomic } from "@/lib/db/atomic";
import type { Db } from "@/lib/db/client";
import {
  hasUnpublishedChanges,
  publishLiveTables,
  restoreFromSnapshot,
} from "@/lib/db/publish";
import { publishedSnapshot } from "@/lib/db/schema";
import type {
  CategoryWithCount,
  ProductWithCategory,
  StoreSettings,
} from "@/lib/domain/types";
import type { StockStatus } from "@/lib/domain/stock";
import type { PublishRepo, PublishedStore } from "./types";

// Rows as `to_jsonb(row)` stores them in the snapshot (lib/db/publish.ts).
type CategoryRow = {
  id: string;
  slug: string;
  name: string;
  icon: string;
  blurb: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type ProductRow = {
  id: string;
  slug: string;
  category_id: string;
  name: string;
  price_centavos: number;
  stock_status: StockStatus;
  key_spec: string;
  description: string;
  image_url: string | null;
  image_pathname: string | null;
  is_sample: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type SettingsRow = {
  name: string;
  headline: string;
  tagline: string;
  phone: string;
  email: string;
  address: string;
  updated_at: string;
};

type SnapshotData = {
  categories: CategoryRow[];
  products: ProductRow[];
  settings: SettingsRow | null;
};

/** The snapshot as domain types, in storefront order. */
export function fromSnapshot(
  data: SnapshotData,
  publishedAt: Date,
): PublishedStore {
  const categories = data.categories
    .map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      icon: c.icon,
      blurb: c.blurb,
      sortOrder: c.sort_order,
      createdAt: new Date(c.created_at),
      updatedAt: new Date(c.updated_at),
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const byId = new Map(categories.map((c) => [c.id, c]));

  const products: ProductWithCategory[] = data.products
    .flatMap((p) => {
      const category = byId.get(p.category_id);
      if (!category) return [];
      return [
        {
          id: p.id,
          slug: p.slug,
          categoryId: p.category_id,
          name: p.name,
          priceCentavos: p.price_centavos,
          stockStatus: p.stock_status,
          keySpec: p.key_spec,
          description: p.description,
          imageUrl: p.image_url,
          imagePathname: p.image_pathname,
          isSample: p.is_sample,
          sortOrder: p.sort_order,
          createdAt: new Date(p.created_at),
          updatedAt: new Date(p.updated_at),
          category: {
            id: category.id,
            slug: category.slug,
            name: category.name,
            icon: category.icon,
            sortOrder: category.sortOrder,
          },
        },
      ];
    })
    .sort(
      (a, b) =>
        a.category.sortOrder - b.category.sortOrder ||
        a.sortOrder - b.sortOrder ||
        a.name.localeCompare(b.name),
    );

  const counts = new Map<string, number>();
  for (const p of products) {
    counts.set(p.categoryId, (counts.get(p.categoryId) ?? 0) + 1);
  }
  const withCounts: CategoryWithCount[] = categories.map((c) => ({
    ...c,
    productCount: counts.get(c.id) ?? 0,
  }));

  const s = data.settings;
  const settings: StoreSettings | null = s && {
    name: s.name,
    headline: s.headline,
    tagline: s.tagline,
    phone: s.phone,
    email: s.email,
    address: s.address,
    updatedAt: new Date(s.updated_at),
  };

  return { categories: withCounts, products, settings, publishedAt };
}

export function createPublishRepo(db: Db): PublishRepo {
  async function snapshotRow() {
    const [row] = await db
      .select()
      .from(publishedSnapshot)
      .where(eq(publishedSnapshot.id, 1));
    return row ?? null;
  }

  return {
    async getPublished() {
      const row = await snapshotRow();
      return row
        ? fromSnapshot(row.data as SnapshotData, row.publishedAt)
        : null;
    },

    async publish() {
      await publishLiveTables(db);
    },

    async discard() {
      if (!(await snapshotRow())) return false;
      await atomic(db, (q) => [...restoreFromSnapshot(q)]);
      return true;
    },

    hasUnpublishedChanges() {
      return hasUnpublishedChanges(db);
    },
  };
}
