import { cx } from "@/components/ui/shared/cx";
import styles from "./Footer.module.css";

export function Footer({
  storeName,
  year,
}: {
  storeName: string;
  year: number;
}) {
  return (
    <footer className={cx("wrap", styles.footer, "t-body-small")}>
      <span>
        © {year} {storeName}
      </span>
      <span>Prices in Philippine pesos (₱). Stock changes daily.</span>
    </footer>
  );
}
