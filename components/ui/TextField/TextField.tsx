import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Icon } from "../Icon";
import { cx } from "../shared/cx";
import styles from "./TextField.module.css";

type FieldProps = {
  label: string;
  hint?: ReactNode;
  /** Error message. When set, the control is marked invalid and describes itself with it. */
  error?: ReactNode;
  /** Applies to the wrapper. */
  className?: string;
};

type TextKind = FieldProps & {
  kind?: "text";
} & Omit<InputHTMLAttributes<HTMLInputElement>, keyof FieldProps>;

type PriceKind = FieldProps & {
  kind: "price";
} & Omit<InputHTMLAttributes<HTMLInputElement>, keyof FieldProps | "type">;

type SelectKind = FieldProps & {
  kind: "select";
  children: ReactNode;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, keyof FieldProps>;

type MultilineKind = FieldProps & {
  kind: "multiline";
} & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, keyof FieldProps>;

export type TextFieldProps = TextKind | PriceKind | SelectKind | MultilineKind;

/**
 * Outlined text field from the Figma "Text field" set: text, select, price (₱ prefix) or multiline.
 */
export function TextField(props: TextFieldProps) {
  const generatedId = useId();
  const id = props.id ?? generatedId;
  const hintId = props.hint ? `${id}-hint` : undefined;
  const errorId = props.error ? `${id}-error` : undefined;
  const describedBy =
    [props["aria-describedby"], hintId, errorId].filter(Boolean).join(" ") ||
    undefined;

  const a11y = {
    id,
    "aria-invalid": props.error ? true : undefined,
    "aria-describedby": describedBy,
  } as const;
  const inputClass = (...extra: (string | false | undefined)[]) =>
    cx(
      styles.input,
      "t-body-large",
      Boolean(props.error) && styles.invalid,
      ...extra,
    );

  let control: ReactNode;
  switch (props.kind) {
    case "select": {
      const { label, hint, error, className, kind, children, ...rest } = props;
      control = (
        <>
          <select {...rest} {...a11y} className={inputClass(styles.select)}>
            {children}
          </select>
          <span className={styles.trailingIcon}>
            <Icon name="expand_more" />
          </span>
        </>
      );
      break;
    }
    case "multiline": {
      const { label, hint, error, className, kind, ...rest } = props;
      control = (
        <textarea
          {...rest}
          {...a11y}
          className={inputClass(styles.multiline)}
        />
      );
      break;
    }
    case "price": {
      const { label, hint, error, className, kind, ...rest } = props;
      control = (
        <>
          <span
            className={cx(styles.prefix, "t-body-large")}
            aria-hidden="true"
          >
            ₱
          </span>
          <input
            inputMode="decimal"
            {...rest}
            {...a11y}
            type="text"
            className={inputClass(styles.price)}
          />
        </>
      );
      break;
    }
    default: {
      const { label, hint, error, className, kind, ...rest } = props;
      control = <input {...rest} {...a11y} className={inputClass()} />;
    }
  }

  return (
    <div className={cx(styles.field, props.className)}>
      <label htmlFor={id} className={cx(styles.label, "t-label-small")}>
        {props.label}
      </label>
      <div className={styles.control}>{control}</div>
      {props.hint && (
        <p id={hintId} className={cx(styles.hint, "t-label-small")}>
          {props.hint}
        </p>
      )}
      {props.error && (
        <p id={errorId} className={cx(styles.error, "t-label-small")}>
          {props.error}
        </p>
      )}
    </div>
  );
}
