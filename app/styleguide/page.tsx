import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Icon } from "@/components/ui/Icon";
import styles from "./styleguide.module.css";

// Temporary reference page for checking tokens against Figma. Removed in ticket 16.

export const metadata: Metadata = {
  title: "Styleguide",
  robots: { index: false, follow: false },
};

const COLOR_GROUPS: { title: string; tokens: string[] }[] = [
  {
    title: "Primary",
    tokens: [
      "primary",
      "on-primary",
      "primary-container",
      "on-primary-container",
    ],
  },
  {
    title: "Secondary and tertiary",
    tokens: [
      "secondary-container",
      "on-secondary-container",
      "tertiary",
      "tertiary-container",
      "on-tertiary-container",
    ],
  },
  {
    title: "Surface",
    tokens: [
      "surface",
      "surface-low",
      "surface-c",
      "surface-high",
      "surface-highest",
      "surface-card",
      "on-surface",
      "on-surface-var",
      "outline",
      "outline-var",
    ],
  },
  {
    title: "Inverse",
    tokens: ["inverse-surface", "inverse-on", "inverse-primary"],
  },
  {
    title: "Status",
    tokens: ["ok", "ok-c", "warn", "warn-c", "err", "err-c", "on-err", "scrim"],
  },
];

const TEXT_STYLES: { figma: string; className: string }[] = [
  { figma: "Display/Hero", className: "t-display-hero" },
  { figma: "Display/Hero Mobile", className: "t-display-hero-mobile" },
  { figma: "Headline/Section", className: "t-headline-section" },
  { figma: "Headline/Medium", className: "t-headline-medium" },
  { figma: "Headline/Small", className: "t-headline-small" },
  { figma: "Title/Large", className: "t-title-large" },
  { figma: "Title/Brand", className: "t-title-brand" },
  { figma: "Title/Medium", className: "t-title-medium" },
  { figma: "Body/Hero", className: "t-body-hero" },
  { figma: "Body/Large", className: "t-body-large" },
  { figma: "Body/Medium", className: "t-body-medium" },
  { figma: "Body/Small", className: "t-body-small" },
  { figma: "Label/Large", className: "t-label-large" },
  { figma: "Label/Medium", className: "t-label-medium" },
  { figma: "Label/Small", className: "t-label-small" },
  { figma: "Label/Overline", className: "t-label-overline" },
  { figma: "Label/Tag", className: "t-label-tag" },
];

const RADII = ["r-sm", "r-md", "r-lg", "r-xl", "r-full"];
const SHADOWS = ["shadow-1", "shadow-3"];
const ICONS = [
  "storefront",
  "chair",
  "fitness_center",
  "search",
  "call",
  "mail",
  "location_on",
  "inventory_2",
  "payments",
  "arrow_forward",
];

export default function StyleguidePage() {
  return (
    <main className={`wrap ${styles.page}`}>
      <h1 className="t-headline-section">Styleguide</h1>
      <p className={`t-body-medium ${styles.muted}`}>
        Tokens from app/tokens.css and text styles from app/typography.css.
        Compare with the Figma variables and text styles.
      </p>

      <section className={styles.section} aria-labelledby="colors">
        <h2 id="colors" className="t-headline-small">
          Color
        </h2>
        {COLOR_GROUPS.map((group) => (
          <div key={group.title}>
            <h3 className={`t-title-medium ${styles.groupTitle}`}>
              {group.title}
            </h3>
            <ul className={styles.swatches}>
              {group.tokens.map((token) => (
                <li key={token} className={styles.swatch}>
                  <span
                    className={styles.chip}
                    style={{ "--swatch": `var(--${token})` } as CSSProperties}
                  />
                  <code className="t-body-small">--{token}</code>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className={styles.section} aria-labelledby="type">
        <h2 id="type" className="t-headline-small">
          Text styles
        </h2>
        <ul className={styles.typeList}>
          {TEXT_STYLES.map((style) => (
            <li key={style.className} className={styles.typeRow}>
              <code className={`t-body-small ${styles.muted}`}>
                {style.figma} · .{style.className}
              </code>
              <span className={style.className}>
                Equipment for the desk and the gym
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="shape">
        <h2 id="shape" className="t-headline-small">
          Radius and elevation
        </h2>
        <ul className={styles.boxes}>
          {RADII.map((token) => (
            <li key={token}>
              <span
                className={styles.radiusBox}
                style={{ "--radius": `var(--${token})` } as CSSProperties}
              />
              <code className="t-body-small">--{token}</code>
            </li>
          ))}
          {SHADOWS.map((token) => (
            <li key={token}>
              <span
                className={styles.shadowBox}
                style={{ "--shadow": `var(--${token})` } as CSSProperties}
              />
              <code className="t-body-small">--{token}</code>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="icons">
        <h2 id="icons" className="t-headline-small">
          Icons
        </h2>
        <ul className={styles.icons} data-testid="icons">
          {ICONS.map((name) => (
            <li key={name}>
              <Icon name={name} />
              <code className="t-body-small">{name}</code>
            </li>
          ))}
          <li>
            <Icon name="chair" fill />
            <code className="t-body-small">chair, filled</code>
          </li>
        </ul>
      </section>
    </main>
  );
}
