import styles from "./document.module.css";

/** "LABEL:" and a line to sign or write on. */
export function SignatureLine({
  label,
  caption,
}: {
  label: string;
  /** Under the line, e.g. "NAME AND SIGNATURE". */
  caption?: string;
}) {
  return (
    <div className={styles.signature}>
      <span>{label}</span>
      <span className={styles.line}>
        {caption && <span className={styles.caption}>{caption}</span>}
      </span>
    </div>
  );
}
