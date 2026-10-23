import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon } from "../Icon";
import { cx } from "../shared/cx";
import styles from "./Button.module.css";

export type ButtonVariant =
  "filled" | "tonal" | "outlined" | "text" | "danger" | "inverse";

type CommonProps = {
  variant?: ButtonVariant;
  /** Material Symbols ligature shown before the label. */
  icon?: string;
  children: ReactNode;
  className?: string;
};

type ButtonAsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps>;

type ButtonAsLink = CommonProps & {
  href: string;
  target?: string;
  rel?: string;
  /** Set to false for links most visitors won't follow, such as admin. */
  prefetch?: boolean;
};

export type ButtonProps = ButtonAsButton | ButtonAsLink;

/** Renders a `<button>`, or a Next.js `<Link>` when `href` is given. */
export function Button(props: ButtonProps) {
  if ("href" in props) {
    const { variant, icon, children, className, ...linkProps } = props;
    return (
      <Link {...linkProps} className={classesFor(variant, className)}>
        <Content icon={icon}>{children}</Content>
      </Link>
    );
  }

  const {
    variant,
    icon,
    children,
    className,
    type = "button",
    ...buttonProps
  } = props;
  return (
    <button
      type={type}
      className={classesFor(variant, className)}
      {...buttonProps}
    >
      <Content icon={icon}>{children}</Content>
    </button>
  );
}

function classesFor(variant: ButtonVariant = "filled", className?: string) {
  return cx(styles.button, styles[variant], "t-label-large", className);
}

function Content({ icon, children }: { icon?: string; children: ReactNode }) {
  return (
    <>
      {icon && <Icon name={icon} size={18} />}
      {children}
    </>
  );
}
