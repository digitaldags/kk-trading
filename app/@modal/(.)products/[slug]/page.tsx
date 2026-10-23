import { Suspense } from "react";
import { getProductDetail } from "@/app/_data/productDetail";
import { ProductDetail } from "@/components/store/ProductDetail";
import {
  MissingProductDialog,
  ProductDialog,
  ProductDialogClose,
} from "@/components/store/ProductDialog";

const TITLE_ID = "product-dialog-title";

type Params = PageProps<"/products/[slug]">["params"];

/**
 * A product opened from the storefront grid, shown in a dialog over the storefront.
 *
 * Unlike the product page this streams: params are read inside Suspense. In this route
 * Next.js fills the `children` slot with its built-in default, which has no `instant`
 * export, so `instant = false` here wouldn't stop the dev-time validation. The fallback
 * is empty, so the dialog still appears in one go once its data is ready. It only opens
 * on a client-side navigation, so there's no no-JavaScript visit to block for.
 */
export default function ProductModal({ params }: { params: Params }) {
  return (
    <Suspense fallback={null}>
      <ProductModalContent params={params} />
    </Suspense>
  );
}

async function ProductModalContent({ params }: { params: Params }) {
  const { slug } = await params;
  const detail = await getProductDetail(slug);

  // A 404 page inside the slot would look broken over the storefront.
  if (!detail) return <MissingProductDialog />;

  return (
    <ProductDialog titleId={TITLE_ID}>
      <ProductDetail
        product={detail.product}
        toneIndex={detail.toneIndex}
        settings={detail.settings}
        headingLevel="h2"
        titleId={TITLE_ID}
        action={<ProductDialogClose />}
      />
    </ProductDialog>
  );
}
