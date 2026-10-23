/** `tel:` link for a phone number typed in any format: "0917 000 0000" -> "tel:09170000000". */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export function mailtoHref(email: string): string {
  return `mailto:${email}`;
}
