import type {
  CategoryWithCount,
  ProductWithCategory,
  StoreSettings,
} from "@/lib/domain/types";
import { AppBar } from "./AppBar";
import { Catalog } from "./Catalog";
import { Contact } from "./Contact";
import { Footer } from "./Footer";
import { Hero } from "./Hero";

export type StorefrontProps = {
  settings: Pick<
    StoreSettings,
    "name" | "headline" | "tagline" | "phone" | "email" | "address"
  >;
  /** In storefront order. A category's position picks its tone. */
  categories: CategoryWithCount[];
  /** Products matching `filter`. */
  products: ProductWithCategory[];
  filter: { categorySlug?: string; q?: string };
  year: number;
};

/** The public landing page. Data comes in as props so it renders the same in tests. */
export function Storefront({
  settings,
  categories,
  products,
  filter,
  year,
}: StorefrontProps) {
  const totalProducts = categories.reduce((n, c) => n + c.productCount, 0);

  return (
    <>
      <AppBar storeName={settings.name} categories={categories} />
      <main>
        <Hero
          settings={settings}
          categories={categories}
          totalProducts={totalProducts}
        />
        <Catalog
          categories={categories}
          products={products}
          totalProducts={totalProducts}
          filter={filter}
        />
        <Contact settings={settings} />
      </main>
      <Footer storeName={settings.name} year={year} />
    </>
  );
}
