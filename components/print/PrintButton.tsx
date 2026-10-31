"use client";

import { Button } from "@/components/ui/Button";

/** Opens the browser's print dialog, where Save as PDF makes the copy to send. */
export function PrintButton() {
  return (
    <Button icon="print" onClick={() => window.print()}>
      Print
    </Button>
  );
}
