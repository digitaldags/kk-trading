"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/shared/cx";
import styles from "./AdminTabs.module.css";

export const ADMIN_SECTIONS = [
  { href: "/admin", icon: "inventory_2", label: "Products" },
  { href: "/admin/categories", icon: "category", label: "Categories" },
  { href: "/admin/settings", icon: "storefront", label: "Store details" },
  { href: "/admin/documents", icon: "description", label: "Documents" },
] as const;

/**
 * Whether `pathname` is in a section: Products (`/admin`) only on its own path, the
 * others also below it (`/admin/documents/<id>` is in Documents).
 */
export function isCurrentSection(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The admin sections as tabs (Figma 12:301). Each is its own page, so they're links
 * marked with `aria-current`, not ARIA tabs. They scroll sideways on small screens.
 */
export function AdminTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin sections" className={styles.tabs}>
      {ADMIN_SECTIONS.map((section) => {
        const current = isCurrentSection(pathname, section.href);
        return (
          <Link
            key={section.href}
            href={section.href}
            prefetch={false}
            aria-current={current ? "page" : undefined}
            className={cx(styles.tab, "t-label-large")}
          >
            <Icon name={section.icon} size={20} />
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
