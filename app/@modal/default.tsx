// Dev-time instant validation checks every Default segment, and this one renders next
// to the storefront page, which blocks on purpose (see app/page.tsx). Opt out like it does.
export const instant = false;

// No dialog on a full page load, or once the dialog's route is left.
export default function Default() {
  return null;
}
