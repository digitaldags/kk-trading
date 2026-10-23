import { fromZodError, ok, type ServiceResult } from "@/lib/domain/result";
import {
  storeSettingsInputSchema,
  type StoreSettingsInput,
} from "@/lib/domain/schemas";
import type { StoreSettings } from "@/lib/domain/types";
import type { SettingsRepo } from "@/lib/repositories/types";

export function createSettingsService(deps: { settings: SettingsRepo }) {
  return {
    async get(): Promise<StoreSettings> {
      const settings = await deps.settings.get();
      if (!settings) {
        throw new Error("Store settings are missing. Run `pnpm db:seed`.");
      }
      return settings;
    },

    async update(
      input: StoreSettingsInput,
    ): Promise<ServiceResult<StoreSettings, keyof StoreSettingsInput>> {
      const parsed = storeSettingsInputSchema.safeParse(input);
      if (!parsed.success) return fromZodError(parsed.error);
      return ok(await deps.settings.update(parsed.data));
    },
  };
}

export type SettingsService = ReturnType<typeof createSettingsService>;
