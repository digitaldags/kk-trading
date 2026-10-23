"use client";

import { IconButton } from "@/components/ui/IconButton";
import { useSnackbar } from "@/components/ui/Snackbar";

type CopyButtonProps = {
  value: string;
  /** What's being copied, e.g. "Phone". Used in the button's name. */
  label: string;
  /** The element showing the value, selected when the clipboard isn't available. */
  targetId: string;
};

/** Copies a contact detail. Copy follows the prototype. */
export function CopyButton({ value, label, targetId }: CopyButtonProps) {
  const { show } = useSnackbar();

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      show(`Copied ${value}`);
    } catch {
      // Clipboard blocked (permissions, insecure context): select the text instead.
      const target = document.getElementById(targetId);
      const selection = window.getSelection();
      if (target && selection) {
        const range = document.createRange();
        range.selectNodeContents(target);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      show("Selected. Press Ctrl+C or Cmd+C to copy.");
    }
  }

  return (
    <IconButton
      icon="content_copy"
      label={`Copy ${label.toLowerCase()}`}
      onClick={copy}
    />
  );
}
