import type { Metadata } from "next";
import { Roboto_Flex } from "next/font/google";
import localFont from "next/font/local";
import "./tokens.css";
import "./typography.css";
import "./globals.css";
import { SnackbarProvider } from "@/components/ui/Snackbar";
import { siteUrl } from "@/lib/site";

// Roboto 400 to 500, self-hosted by `pnpm fonts:fetch` (Latin-1, punctuation and ₱).
// next/font/google broke the build in CI when Google served Roboto from a URL with
// extra query parameters (scripts/fonts-fetch.ts).
const roboto = localFont({
  src: "./fonts/roboto.woff2",
  weight: "400 500",
  style: "normal",
  variable: "--font-roboto",
});

const robotoFlex = Roboto_Flex({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-roboto-flex",
});

// Material Symbols Rounded, subset to lib/iconNames.ts by `pnpm icons:fetch` and served
// from our own origin. next/font/google can't be used: its subsetting drops the ligatures.
// display "block" hides ligature text until the font arrives, so names never flash as words.
const materialSymbols = localFont({
  src: "./fonts/material-symbols-rounded.woff2",
  display: "block",
  variable: "--font-icons",
  adjustFontFallback: false,
});

// Pages set their own titles and descriptions from the store settings. `metadataBase`
// makes canonical and Open Graph URLs absolute (NEXT_PUBLIC_SITE_URL, see lib/site.ts).
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: "KK Trading",
  description:
    "Office furniture and fitness gear for homes, offices and training spaces.",
};

// `modal` is the @modal slot: the product dialog when a card is followed from the grid
// (app/@modal/(.)products/[slug]), otherwise nothing.
export default function RootLayout({ children, modal }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${roboto.variable} ${robotoFlex.variable} ${materialSymbols.variable}`}
    >
      <body id="top">
        <SnackbarProvider>
          {children}
          {modal}
        </SnackbarProvider>
      </body>
    </html>
  );
}
