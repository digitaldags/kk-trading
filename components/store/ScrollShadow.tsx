"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./ScrollShadow.module.css";

/**
 * The app bar's `<header>`. Sets `data-scrolled` once the page has scrolled, which
 * shows the hairline under it. A sentinel at the top of the page is watched instead
 * of listening to every scroll event.
 */
export function ScrollShadow({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(([entry]) => {
      setScrolled(entry ? !entry.isIntersecting : false);
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" />
      <header className={className} data-scrolled={scrolled || undefined}>
        {children}
      </header>
    </>
  );
}
