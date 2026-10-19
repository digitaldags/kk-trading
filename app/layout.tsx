import type { Metadata } from "next";
import { Roboto, Roboto_Flex } from "next/font/google";
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

// Loaded as a stylesheet, not through next/font: subsetting would drop the ligature glyphs.
// display=block hides the ligature text until the font arrives, so names never flash as words.
const MATERIAL_SYMBOLS_URL =
  "https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,400,0..1,0&display=block";

export const metadata: Metadata = {
  title: "KK Trading",
  description:
    "Office furniture and fitness gear for homes, offices and training spaces.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${roboto.variable} ${robotoFlex.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link rel="stylesheet" href={MATERIAL_SYMBOLS_URL} />
      </head>
      <body>
        <SnackbarProvider>{children}</SnackbarProvider>
      </body>
    </html>
  );
}
