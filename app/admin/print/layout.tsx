import "./print.css";

// The print previews (ticket 23). Outside the (console) group, so there's no app bar,
// tabs or Publish bar; the root layout already loads the tokens and fonts. Like every
// admin route, each page calls `requireAdmin()` itself.
export default function PrintLayout({ children }: LayoutProps<"/admin/print">) {
  return children;
}
