"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cx } from "../shared/cx";
import styles from "./Snackbar.module.css";

/** How long each message stays on screen. */
export const SNACKBAR_DURATION_MS = 4200;

/** A link after the text, opened in a new tab: "Receipt DR-1 created. Print". */
export type SnackbarAction = { label: string; href: string };

type Message = { id: number; text: string; action?: SnackbarAction };

type SnackbarContextValue = {
  /** Queues a message. Messages show one at a time. */
  show: (text: string, action?: SnackbarAction) => void;
};

type RegionContextValue = {
  current: Message | undefined;
  /** The region that shows messages: the newest one mounted, else the page's own. */
  activeRegion: string;
  /** Returns the cleanup that removes the region again. */
  register: (id: string) => () => void;
  /** Holds the current message while it's hovered or focused, so its link can be reached. */
  setPaused: (paused: boolean) => void;
};

const PAGE_REGION = "page";

const SnackbarContext = createContext<SnackbarContextValue | null>(null);
const RegionContext = createContext<RegionContextValue | null>(null);

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Message[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [paused, setPaused] = useState(false);
  const nextId = useRef(0);
  const current = queue[0];

  const show = useCallback((text: string, action?: SnackbarAction) => {
    nextId.current += 1;
    const id = nextId.current;
    setQueue((q) => [...q, { id, text, ...(action ? { action } : {}) }]);
  }, []);

  const register = useCallback((id: string) => {
    setRegions((r) => [...r, id]);
    return () => setRegions((r) => r.filter((x) => x !== id));
  }, []);

  useEffect(() => {
    if (!current || paused) return;
    const timer = setTimeout(
      () => setQueue((q) => q.slice(1)),
      SNACKBAR_DURATION_MS,
    );
    return () => clearTimeout(timer);
  }, [current, paused]);

  const value = useMemo(() => ({ show }), [show]);
  const region = useMemo(
    () => ({
      current,
      activeRegion: regions[regions.length - 1] ?? PAGE_REGION,
      register,
      setPaused,
    }),
    [current, regions, register],
  );

  return (
    <SnackbarContext.Provider value={value}>
      <RegionContext.Provider value={region}>
        {children}
        <Region id={PAGE_REGION} />
      </RegionContext.Provider>
    </SnackbarContext.Provider>
  );
}

/**
 * A place for snackbars inside a modal `<dialog>`. The dialog sits in the top layer and
 * makes the page inert, so the page's own region would be hidden behind it. While this is
 * mounted, messages show here instead. Renders nothing outside a `SnackbarProvider`.
 */
export function SnackbarRegion() {
  const context = useContext(RegionContext);
  const id = useId();
  const register = context?.register;

  useEffect(() => register?.(id), [register, id]);

  return context ? <Region id={id} /> : null;
}

function Region({ id }: { id: string }) {
  const context = useContext(RegionContext);
  const message = context?.activeRegion === id ? context.current : undefined;

  // Always mounted so screen readers announce each new message.
  return (
    <div role="status" aria-live="polite" className={styles.region}>
      {message && (
        <div
          key={message.id}
          className={cx(
            styles.snackbar,
            message.action && styles.withAction,
            "t-body-medium",
          )}
          onMouseEnter={() => context?.setPaused(true)}
          onMouseLeave={() => context?.setPaused(false)}
          onFocus={() => context?.setPaused(true)}
          onBlur={() => context?.setPaused(false)}
        >
          <span>{message.text}</span>
          {message.action && (
            <a
              href={message.action.href}
              target="_blank"
              rel="noopener"
              className={cx(styles.action, "t-label-large")}
            >
              {message.action.label}
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export function useSnackbar(): SnackbarContextValue {
  const context = useContext(SnackbarContext);
  if (!context) {
    throw new Error("useSnackbar must be used inside <SnackbarProvider>.");
  }
  return context;
}
