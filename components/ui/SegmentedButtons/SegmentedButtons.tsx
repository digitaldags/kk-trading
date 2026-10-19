"use client";

import { useId } from "react";
import { Icon } from "../Icon";
import { cx } from "../shared/cx";
import styles from "./SegmentedButtons.module.css";

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
};

export type SegmentedButtonsProps<T extends string> = {
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

/** Single-choice segmented control, as in the product editor's stock picker. */
export function SegmentedButtons<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: SegmentedButtonsProps<T>) {
  const labelId = useId();
  return (
    <div className={cx(styles.field, className)}>
      <span id={labelId} className={cx(styles.label, "t-label-small")}>
        {label}
      </span>
      <div role="group" aria-labelledby={labelId} className={styles.group}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              className={cx(
                styles.segment,
                selected && styles.selected,
                "t-label-large",
              )}
              onClick={() => onChange(option.value)}
            >
              {selected && <Icon name="check" size={18} />}
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
