import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/shared/cx";
import type { StoreSettings } from "@/lib/domain/types";
import styles from "./Contact.module.css";
import { CopyButton } from "./CopyButton";

type ContactProps = {
  settings: Pick<StoreSettings, "phone" | "email" | "address">;
};

export function Contact({ settings }: ContactProps) {
  const { phone, email, address } = settings;
  return (
    <section
      id="contact"
      className={styles.section}
      aria-labelledby="contact-title"
    >
      <div className="wrap">
        <div className={styles.panel}>
          <div className={styles.intro}>
            <h2 id="contact-title" className="t-headline-medium">
              Ask about an item
            </h2>
            <p className={cx(styles.lead, "t-body-large")}>
              Call, text or email us for stock, delivery and bulk pricing.
              Mention the product name so we can check it quickly.
            </p>
          </div>
          <ul className={styles.list}>
            {phone && (
              <ContactRow
                id="contact-phone"
                icon="call"
                label="Phone"
                value={phone}
                href={`tel:${phone.replace(/[^\d+]/g, "")}`}
              />
            )}
            {email && (
              <ContactRow
                id="contact-email"
                icon="mail"
                label="Email"
                value={email}
                href={`mailto:${email}`}
              />
            )}
            {address && (
              <ContactRow
                id="contact-address"
                icon="location_on"
                label="Address"
                value={address}
              />
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}

function ContactRow({
  id,
  icon,
  label,
  value,
  href,
}: {
  id: string;
  icon: string;
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <li className={styles.row}>
      <Icon name={icon} className={styles.icon} />
      <div className={styles.text}>
        <span className={cx(styles.label, "t-body-small")}>{label}</span>
        {href ? (
          <a id={id} href={href} className={cx(styles.value, "t-body-large")}>
            {value}
          </a>
        ) : (
          <span id={id} className={cx(styles.value, "t-body-large")}>
            {value}
          </span>
        )}
      </div>
      <CopyButton value={value} label={label} targetId={id} />
    </li>
  );
}
