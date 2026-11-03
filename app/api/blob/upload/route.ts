import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import {
  BRANDING_IMAGE_PREFIX,
  BRANDING_IMAGE_TYPES,
  MAX_PRODUCT_IMAGE_BYTES,
  PRODUCT_IMAGE_PREFIX,
  PRODUCT_IMAGE_TYPES,
} from "@/lib/domain/productImages";

/** Where uploads may go, and what each folder accepts. Same size limit for both. */
const FOLDERS = [
  { prefix: PRODUCT_IMAGE_PREFIX, types: PRODUCT_IMAGE_TYPES },
  { prefix: BRANDING_IMAGE_PREFIX, types: BRANDING_IMAGE_TYPES },
] as const;

/** File names the editors make: `.webp` or `.jpg` photos, a `.png`/`.jpg`/`.webp` logo. */
const IMAGE_EXTENSION = /\.(png|jpe?g|webp)$/i;

/**
 * Signs a client upload of one product photo or the store logo to Vercel Blob
 * (`upload()` from `@vercel/blob/client` in the product editor and store details). The
 * file goes from the browser straight to Blob; the row is written afterwards by the
 * form's save action. The token only allows PNG, JPEG and WebP: never SVG.
 *
 * Only signed-in admins get a token: `requireAdmin()` answers 401 otherwise, before
 * anything else runs (even before the Blob token is read). proxy.ts doesn't cover `/api`,
 * so this check is the protection. Upload-completed callbacks aren't used (they can't
 * reach a local server), so only token requests are accepted.
 */
export async function POST(request: Request) {
  await requireAdmin();

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (body?.type !== "blob.generate-client-token") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const folder = FOLDERS.find((f) => pathname.startsWith(f.prefix));
        if (!folder) {
          throw new Error("Uploads go in products/ or branding/.");
        }
        if (!IMAGE_EXTENSION.test(pathname)) {
          throw new Error("Upload a PNG, JPEG or WebP image.");
        }
        return {
          allowedContentTypes: [...folder.types],
          maximumSizeInBytes: MAX_PRODUCT_IMAGE_BYTES,
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed." },
      { status: 400 },
    );
  }
}
