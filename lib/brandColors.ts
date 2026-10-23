/**
 * Brand colors for generated images (Open Graph image, apple-icon), which can't read CSS
 * variables. Copies of app/tokens.css; lib/brandColors.test.ts keeps them in step.
 */
export const BRAND_COLORS = {
  primary: "#2b5f8c",
  primaryContainer: "#e4effb",
  onPrimaryContainer: "#0b2a45",
  surface: "#ffffff",
  onSurfaceVar: "#4a5059",
} as const;

/** The CSS custom property each color copies. */
export const BRAND_COLOR_TOKENS: Record<keyof typeof BRAND_COLORS, string> = {
  primary: "--primary",
  primaryContainer: "--primary-container",
  onPrimaryContainer: "--on-primary-container",
  surface: "--surface",
  onSurfaceVar: "--on-surface-var",
};
