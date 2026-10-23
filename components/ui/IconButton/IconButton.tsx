import Link from "next/link";
import type { ButtonHTMLAttributes } from "react";
import { Icon } from "../Icon";
import { cx } from "../shared/cx";
import styles from "./IconButton.module.css";

type CommonProps = {
  /** Material Symbols ligature. */
  icon: string;
  /** Accessible name, also shown as a tooltip. */
  label: string;
  tone?: "default" | "danger" | "primary";
  className?: string;
};

type IconButtonAsButton = CommonProps &
  Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    keyof CommonProps | "children" | "aria-label" | "title"
  >;

type IconButtonAsLink = CommonProps & {
  href: string;
  /** Set to false for links most visitors won't follow, such as admin. */
  prefetch?: boolean;
};

export type IconButtonProps = IconButtonAsButton | IconButtonAsLink;

/** Renders a `<button>`, or a Next.js `<Link>` when `href` is given. */
export function IconButton(props: IconButtonProps) {
  const { icon, label, tone = "default", className } = props;
  const classes = cx(
    styles.iconButton,
    tone !== "default" && styles[tone],
    className,
  );

  if ("href" in props) {
    return (
      <Link
        href={props.href}
        prefetch={props.prefetch}
        aria-label={label}
        title={label}
        className={classes}
      >
        <Icon name={icon} />
      </Link>
    );
  }

  const {
    icon: _icon,
    label: _label,
    tone: _tone,
    className: _className,
    type = "button",
    ...rest
  } = props;
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={classes}
      {...rest}
    >
      <Icon name={icon} />
    </button>
  );
}
