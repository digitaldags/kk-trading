import type { Metadata } from "next";
import { Roboto, Roboto_Flex } from "next/font/google";
import localFont from "next/font/local";
import "./tokens.css";
import "./typography.css";
import "./globals.css";
import { SnackbarProvider } from "@/components/ui/Snackbar";

const roboto = Roboto({
  weight: ["400", "500"],
  subsets: ["latin"],
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

export const metadata: Metadata = {
  title: "KK Trading",
  description:
    "Office furniture and fitness gear for homes, offices and training spaces.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${roboto.variable} ${robotoFlex.variable} ${materialSymbols.variable}`}
    >
      <body id="top">
        <SnackbarProvider>{children}</SnackbarProvider>
      </body>
    </html>
  );
}
