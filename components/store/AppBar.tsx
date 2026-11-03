import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { cx } from "@/components/ui/shared/cx";
import { logoDisplaySize } from "@/lib/domain/logo";
import type { Category, StoreSettings } from "@/lib/domain/types";
import styles from "./AppBar.module.css";
import { categoryHref } from "./catalogUrl";
import { ScrollShadow } from "./ScrollShadow";

type AppBarProps = {
  storeName: string;
  categories: Pick<Category, "id" | "slug" | "name">[];
  /**
   * On the storefront the brand and Contact are same-page anchors, which keep the
   * current filter. Elsewhere (a product page) they lead back to the storefront.
   */
  onStorefront?: boolean;
  /**
   * The published store logo (ticket 40). Shown in place of the icon tile; its stored
   * size reserves the box, so nothing shifts as it loads.
   */
  logo?: Pick<StoreSettings, "logoUrl" | "logoWidth" | "logoHeight">;
};

export function AppBar({
  storeName,
  categories,
  onStorefront = true,
  logo,
}: AppBarProps) {
  const logoSize =
    logo?.logoUrl && logoDisplaySize(logo.logoWidth, logo.logoHeight);
  return (
    <ScrollShadow className={styles.appBar}>
      <div className={cx("wrap", styles.inner)}>
        <a
          href={onStorefront ? "#top" : "/"}
          className={styles.brand}
          aria-label={
            onStorefront ? `${storeName}, back to top` : `${storeName}, home`
          }
        >
          {logo?.logoUrl && logoSize ? (
            // alt="": the link's name already says whose store this is.
            <Image
              src={logo.logoUrl}
              alt=""
              width={logoSize.width}
              height={logoSize.height}
              priority
              className={styles.logo}
            />
          ) : (
            <span className={styles.mark}>
              <Icon name="storefront" />
            </span>
          )}
          <span className={cx(styles.name, "t-title-brand")}>{storeName}</span>
        </a>
        <nav aria-label="Sections" className={styles.nav}>
          {categories.map((c) => (
            <Button key={c.id} variant="text" href={categoryHref(c.slug)}>
              {c.name}
            </Button>
          ))}
          <Button variant="text" href={onStorefront ? "#contact" : "/#contact"}>
            Contact
          </Button>
        </nav>
        <IconButton
          href="/admin"
          prefetch={false}
          icon="manage_accounts"
          label="Admin"
        />
      </div>
    </ScrollShadow>
  );
}
