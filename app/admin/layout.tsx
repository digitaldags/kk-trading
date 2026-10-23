import type { Metadata } from "next";

// No auth check here: layouts don't re-run on every navigation, so each admin page and
// action calls `requireAdmin()` itself. The login page lives under this layout too.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return children;
}
