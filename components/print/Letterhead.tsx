import { cx } from "@/components/ui/shared/cx";
import { phoneLine } from "@/lib/domain/documents";
import type { StoreSettings } from "@/lib/domain/types";
import styles from "./document.module.css";

/** What the letterhead prints, from the store settings admin last saved. */
export type LetterheadSettings = Pick<
  StoreSettings,
  "name" | "slogan" | "logoUrl" | "phone" | "phone2"
>;

/** The store's logo, name, slogan and phones, then the document's title. */
export function Letterhead({
  settings,
  title,
  draft = false,
}: {
  settings: LetterheadSettings;
  title: string;
  /** A draft quotation: "DRAFT" after the title. */
  draft?: boolean;
}) {
  const phones = phoneLine(settings.phone, settings.phone2);
  return (
    <header className={styles.letterhead}>
      <div className={styles.brand}>
        {settings.logoUrl && (
          // A plain img, loaded eagerly: a lazy one can still be blank when the
          // print dialog opens.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={settings.logoUrl}
            alt=""
            loading="eager"
            decoding="sync"
            className={styles.logo}
          />
        )}
        <div className="t-print-body">
          <p className="t-print-strong">{settings.name}</p>
          {settings.slogan && (
            <p className={styles.slogan}>{settings.slogan}</p>
          )}
          {phones && <p className="t-print-strong">{phones}</p>}
        </div>
      </div>
      <h1 className={cx(styles.title, "t-print-heading")}>
        {title}
        {draft && <span className={styles.draft}>DRAFT</span>}
      </h1>
    </header>
  );
}
