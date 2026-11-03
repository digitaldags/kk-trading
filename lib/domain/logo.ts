// The store logo in the storefront app bar (ticket 40). Its size is read in the browser
// at upload and stored, so the page reserves the logo's box before it loads (no layout
// shift).

/** The app bar's logo height in px: the same as the icon tile it replaces. */
export const LOGO_HEIGHT = 40;

/** The widest the logo may be in the app bar, in px. Wider logos shrink to fit. */
export const LOGO_MAX_WIDTH = 160;

/** The largest width or height accepted for an uploaded logo, in px. */
export const MAX_LOGO_SIDE = 20_000;

/**
 * The logo's box in the app bar: 40px tall, or 160px wide if that would be wider.
 * A logo saved before ticket 40 has no size; it gets the icon tile's 40 × 40 box
 * (shown with `object-fit: contain`).
 */
export function logoDisplaySize(
  width: number | null,
  height: number | null,
): { width: number; height: number } {
  if (!width || !height) return { width: LOGO_HEIGHT, height: LOGO_HEIGHT };
  const atFullHeight = (width * LOGO_HEIGHT) / height;
  if (atFullHeight <= LOGO_MAX_WIDTH) {
    return {
      width: Math.max(1, Math.round(atFullHeight)),
      height: LOGO_HEIGHT,
    };
  }
  return {
    width: LOGO_MAX_WIDTH,
    height: Math.max(1, Math.round((height * LOGO_MAX_WIDTH) / width)),
  };
}
