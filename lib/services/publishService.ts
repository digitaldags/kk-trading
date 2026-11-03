import type {
  ProductRepo,
  PublishRepo,
  SettingsRepo,
} from "@/lib/repositories/types";
import type { ImageStore } from "./imageStore";

export const NOTHING_PUBLISHED =
  "Nothing has been published yet, so there's nothing to go back to.";

/**
 * Draft and publish (ticket 15). Admin edits the live tables; the storefront shows the
 * published snapshot. A product photo or the store logo is deleted only once neither of
 * them uses it: after a publish, files only the old snapshot showed; after a discard,
 * files only the discarded draft had.
 */
export function createPublishService(deps: {
  publish: PublishRepo;
  products: ProductRepo;
  settings: SettingsRepo;
  imageStore: ImageStore;
  logError?: (message: string, error: unknown) => void;
}) {
  const logError = deps.logError ?? console.error;

  type Files = { photos: string[]; logos: string[] };

  /** Deletes the files that nothing, draft or published, still uses. */
  async function deleteUnused({ photos, logos }: Files) {
    const unused: { url: string; label: string }[] = [];
    for (const url of new Set(photos)) {
      if (!(await deps.products.isImageInUse(url))) {
        unused.push({ url, label: "product image" });
      }
    }
    for (const url of new Set(logos)) {
      if (!(await deps.settings.isLogoInUse(url))) {
        unused.push({ url, label: "store logo" });
      }
    }
    for (const { url, label } of unused) {
      try {
        await deps.imageStore.delete(url);
      } catch (error) {
        logError(`Couldn't delete ${label} ${url}`, error);
      }
    }
  }

  const photosOf = (products: { imageUrl: string | null }[]) =>
    products.flatMap((p) => (p.imageUrl ? [p.imageUrl] : []));
  const logoOf = (settings: { logoUrl: string | null } | null | undefined) =>
    settings?.logoUrl ? [settings.logoUrl] : [];

  const draftFiles = async (): Promise<Files> => ({
    photos: photosOf(await deps.products.listWithCategory()),
    logos: logoOf(await deps.settings.get()),
  });

  const publishedFiles = async (): Promise<Files> => {
    const published = await deps.publish.getPublished();
    return {
      photos: photosOf(published?.products ?? []),
      logos: logoOf(published?.settings),
    };
  };

  return {
    /** For the app bar pill: whether the draft differs from what's live. */
    async status(): Promise<{ unpublished: boolean }> {
      return { unpublished: await deps.publish.hasUnpublishedChanges() };
    },

    /** Makes the draft live, then deletes photos and logos the store no longer shows. */
    async publish(): Promise<void> {
      const before = await publishedFiles();
      await deps.publish.publish();
      await deleteUnused(before);
    },

    /**
     * Puts the draft back to what's live, then deletes files uploaded since. False when
     * nothing was ever published.
     */
    async discard(): Promise<boolean> {
      const before = await draftFiles();
      if (!(await deps.publish.discard())) return false;
      await deleteUnused(before);
      return true;
    },
  };
}

export type PublishService = ReturnType<typeof createPublishService>;
