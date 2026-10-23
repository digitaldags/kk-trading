import type { ProductRepo, PublishRepo } from "@/lib/repositories/types";
import type { ImageStore } from "./imageStore";

export const NOTHING_PUBLISHED =
  "Nothing has been published yet, so there's nothing to go back to.";

/**
 * Draft and publish (ticket 15). Admin edits the live tables; the storefront shows the
 * published snapshot. A product photo is deleted only once neither of them uses it:
 * after a publish, photos only the old snapshot showed; after a discard, photos only the
 * discarded draft had.
 */
export function createPublishService(deps: {
  publish: PublishRepo;
  products: ProductRepo;
  imageStore: ImageStore;
  logError?: (message: string, error: unknown) => void;
}) {
  const logError = deps.logError ?? console.error;

  /** Deletes the photos in `urls` that no product, draft or published, still uses. */
  async function deleteUnused(urls: Iterable<string>) {
    for (const url of new Set(urls)) {
      if (await deps.products.isImageInUse(url)) continue;
      try {
        await deps.imageStore.delete(url);
      } catch (error) {
        logError(`Couldn't delete product image ${url}`, error);
      }
    }
  }

  const draftPhotos = async () =>
    (await deps.products.listWithCategory()).flatMap((p) =>
      p.imageUrl ? [p.imageUrl] : [],
    );

  const publishedPhotos = async () =>
    ((await deps.publish.getPublished())?.products ?? []).flatMap((p) =>
      p.imageUrl ? [p.imageUrl] : [],
    );

  return {
    /** For the app bar pill: whether the draft differs from what's live. */
    async status(): Promise<{ unpublished: boolean }> {
      return { unpublished: await deps.publish.hasUnpublishedChanges() };
    },

    /** Makes the draft live, then deletes photos the store no longer shows. */
    async publish(): Promise<void> {
      const before = await publishedPhotos();
      await deps.publish.publish();
      await deleteUnused(before);
    },

    /**
     * Puts the draft back to what's live, then deletes photos uploaded since. False when
     * nothing was ever published.
     */
    async discard(): Promise<boolean> {
      const before = await draftPhotos();
      if (!(await deps.publish.discard())) return false;
      await deleteUnused(before);
      return true;
    },
  };
}

export type PublishService = ReturnType<typeof createPublishService>;
