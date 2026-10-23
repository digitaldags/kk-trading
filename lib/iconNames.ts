import { CATEGORY_ICONS } from "@/lib/domain/icons";

/**
 * Icons the UI uses, besides the category icons. The Material Symbols font is
 * subset to exactly these, so an icon missing here renders as its name in text.
 * After changing this list, run `pnpm icons:fetch`. `lib/icon-names.test.ts` checks
 * every icon used in app/ and components/ is listed, and that the font is up to date.
 */
const UI_ICONS = [
  "add",
  "add_photo_alternate",
  "arrow_back",
  "arrow_downward",
  "arrow_forward",
  "arrow_upward",
  "block",
  "call",
  "check",
  "check_circle",
  "close",
  "cloud_done",
  "content_copy",
  "delete",
  "edit",
  "edit_note",
  "error",
  "expand_more",
  "grid_view",
  "info",
  "location_on",
  "lock",
  "logout",
  "mail",
  "manage_accounts",
  "payments",
  "publish",
  "search",
  "search_off",
  "storefront",
  "warning",
] as const;

/** Every icon the font must contain, sorted and unique (Google Fonts requires sorted names). */
export const ICON_NAMES: readonly string[] = [
  ...new Set<string>([...UI_ICONS, ...CATEGORY_ICONS]),
].sort();

/**
 * Google Fonts URL for Material Symbols Rounded subset to `ICON_NAMES`.
 * `pnpm icons:fetch` downloads that font into app/fonts/, where next/font/local serves it
 * from our own origin. (next/font/google can't be used: its subsetting drops the ligatures.)
 */
export const ICON_FONT_CSS_URL =
  "https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,400,0..1,0" +
  `&icon_names=${ICON_NAMES.join(",")}&display=block`;
