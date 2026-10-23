import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import {
  MAX_PRODUCT_IMAGE_BYTES,
  PRODUCT_IMAGE_PREFIX,
  PRODUCT_IMAGE_TYPES,
} from "@/lib/domain/productImages";

/**
 * Signs a client upload of one product photo to Vercel Blob (`upload()` from
 * `@vercel/blob/client` in the product editor). The photo goes from the browser straight
 * to Blob; the product row is written afterwards by the editor's save action.
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
        if (!pathname.startsWith(PRODUCT_IMAGE_PREFIX)) {
          throw new Error("Product photos go in products/.");
        }
        return {
          allowedContentTypes: [...PRODUCT_IMAGE_TYPES],
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
