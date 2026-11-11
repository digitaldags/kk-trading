/** How long the object URL lives. Some browsers start the download after the click. */
const REVOKE_AFTER_MS = 10_000;

/** Saves a file built in the browser, through a temporary object URL. */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
}
