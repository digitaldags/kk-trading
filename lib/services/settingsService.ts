import {
  fieldError,
  fromZodError,
  ok,
  type ServiceResult,
} from "@/lib/domain/result";
import { isBrandingImageUrl } from "@/lib/domain/productImages";
import {
  storeSettingsInputSchema,
  type StoreSettingsInput,
} from "@/lib/domain/schemas";
import type { StoreSettings } from "@/lib/domain/types";
import type { SettingsRepo } from "@/lib/repositories/types";
import type { ImageStore } from "./imageStore";

const BAD_LOGO = "Upload the logo again.";

export function createSettingsService(deps: {
  settings: SettingsRepo;
  imageStore: ImageStore;
  /** Where a failed logo cleanup is reported. The save itself still succeeds. */
  logError?: (message: string, error: unknown) => void;
}) {
  const logError = deps.logError ?? console.error;

  // The same rule as product photos: called after the database write, and a logo the
  // published store still shows stays until a publish no longer needs it
  // (publishService deletes it then).
  async function deleteLogo(url: string) {
    if (await deps.settings.isLogoInUse(url)) return;
    try {
      await deps.imageStore.delete(url);
    } catch (error) {
      logError(`Couldn't delete store logo ${url}`, error);
    }
  }

  async function get(): Promise<StoreSettings> {
    const settings = await deps.settings.get();
    if (!settings) {
      throw new Error("Store settings are missing. Run `pnpm db:seed`.");
    }
    return settings;
  }

  return {
    get,

    async update(
      input: StoreSettingsInput,
    ): Promise<ServiceResult<StoreSettings, keyof StoreSettingsInput>> {
      const parsed = storeSettingsInputSchema.safeParse(input);
      if (!parsed.success) return fromZodError(parsed.error);
      const { logo, ...values } = parsed.data;
      if (logo && !isBrandingImageUrl(logo.url)) {
        return fieldError("logo", BAD_LOGO);
      }

      const existing = await deps.settings.get();
      // Left out: keep the current logo and its size. null: no logo.
      const logoFields =
        logo === undefined
          ? {
              logoUrl: existing?.logoUrl ?? null,
              logoPathname: existing?.logoPathname ?? null,
              logoWidth: existing?.logoWidth ?? null,
              logoHeight: existing?.logoHeight ?? null,
            }
          : {
              logoUrl: logo?.url ?? null,
              logoPathname: logo?.pathname ?? null,
              logoWidth: logo?.width ?? null,
              logoHeight: logo?.height ?? null,
            };
      const saved = await deps.settings.update({ ...values, ...logoFields });

      // Delete the replaced or removed logo only once the new row is saved.
      if (existing?.logoUrl && existing.logoUrl !== saved.logoUrl) {
        await deleteLogo(existing.logoUrl);
      }
      return ok(saved);
    },

    /**
     * Deletes a logo the form uploaded but never saved (the admin left after a failed
     * save). Only logos, and never one the store still shows.
     */
    async discardUnusedLogo(url: string): Promise<void> {
      if (!isBrandingImageUrl(url)) return;
      await deleteLogo(url);
    },
  };
}

export type SettingsService = ReturnType<typeof createSettingsService>;
