"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cx } from "../shared/cx";
import styles from "./Snackbar.module.css";

/** How long each message stays on screen. */
export const SNACKBAR_DURATION_MS = 4200;

type Message = { id: number; text: string };

type SnackbarContextValue = {
  /** Queues a message. Messages show one at a time. */
  show: (text: string) => void;
};

const SnackbarContext = createContext<SnackbarContextValue | null>(null);

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Message[]>([]);
  const nextId = useRef(0);
  const current = queue[0];

  const show = useCallback((text: string) => {
    nextId.current += 1;
    const id = nextId.current;
    setQueue((q) => [...q, { id, text }]);
  }, []);

  useEffect(() => {
    if (!current) return;
    const timer = setTimeout(
      () => setQueue((q) => q.slice(1)),
      SNACKBAR_DURATION_MS,
    );
    return () => clearTimeout(timer);
  }, [current]);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <SnackbarContext.Provider value={value}>
      {children}
      {/* Always mounted so screen readers announce each new message. */}
      <div role="status" aria-live="polite" className={styles.region}>
        {current && (
          <div
            key={current.id}
            className={cx(styles.snackbar, "t-body-medium")}
          >
            {current.text}
          </div>
        )}
      </div>
    </SnackbarContext.Provider>
  );
}

export function useSnackbar(): SnackbarContextValue {
  const context = useContext(SnackbarContext);
  if (!context) {
    throw new Error("useSnackbar must be used inside <SnackbarProvider>.");
  }
  return context;
}
