import { headers } from "next/headers";

/**
 * The visitor's address, for the sign-in rate limit. Vercel sets x-forwarded-for to the
 * visitor's address; the first entry is the client.
 */
export async function clientIp(): Promise<string> {
  const list = await headers();
  const forwarded = list.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || list.get("x-real-ip")?.trim() || "unknown";
}
