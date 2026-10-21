import { Icon } from "@/components/ui/Icon";
import { ProductCard } from "@/components/ui/ProductCard";
import { cx } from "@/components/ui/shared/cx";
import type {
  CategoryWithCount,
  ProductWithCategory,
} from "@/lib/domain/types";
import styles from "./Catalog.module.css";
import { CatalogFilters } from "./CatalogFilters";

type CatalogProps = {
  categories: CategoryWithCount[];
  products: ProductWithCategory[];
  totalProducts: number;
  filter: { categorySlug?: string; q?: string };
};

export function Catalog({
  categories,
  products,
  totalProducts,
  filter,
}: CatalogProps) {
  // Tones follow the category's position, so a product matches its category tile.
  const toneIndex = new Map(categories.map((c, i) => [c.id, i]));

  return (
    <section
      id="catalog"
      className={styles.section}
      aria-labelledby="catalog-title"
    >
      <div className="wrap">
        <div className={styles.head}>
          <h2 id="catalog-title" className="t-headline-section">
            Products
          </h2>
          <p className={cx(styles.count, "t-body-medium")} aria-live="polite">
            {products.length} of {totalProducts} shown
          </p>
        </div>

        <CatalogFilters
          categories={categories.map(({ slug, name }) => ({ slug, name }))}
          category={filter.categorySlug}
          q={filter.q}
        >
          {products.length === 0 ? (
            <div className={styles.empty}>
              <Icon name="search_off" size={40} />
              <p className="t-title-medium">No products match</p>
              <p className="t-body-medium">Try another search or category.</p>
            </div>
          ) : (
            <ul className={styles.grid}>
              {products.map((p) => (
                <li key={p.id} className={styles.item}>
                  <ProductCard
                    name={p.name}
                    category={p.category.name}
                    spec={p.keySpec}
                    priceCentavos={p.priceCentavos}
                    status={p.stockStatus}
                    imageUrl={p.imageUrl}
                    icon={p.category.icon}
                    toneIndex={toneIndex.get(p.categoryId) ?? 0}
                  />
                </li>
              ))}
            </ul>
          )}
        </CatalogFilters>
      </div>
    </section>
  );
}
