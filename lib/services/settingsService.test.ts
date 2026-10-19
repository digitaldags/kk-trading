import { beforeEach, describe, expect, it } from "vitest";
import type { StoreSettingsInput } from "@/lib/domain/schemas";
import { createSettingsService } from "./settingsService";
import { createFakeStore, type FakeStore } from "./testing/fakes";

let store: FakeStore;
let service: ReturnType<typeof createSettingsService>;

const input: StoreSettingsInput = {
  name: "KK Trading",
  headline: "Equipment for the desk and the gym",
  tagline: "Office furniture and fitness gear.",
  phone: "0917 000 0000",
  email: "hello@example.com",
  address: "Quezon City",
};

beforeEach(() => {
  store = createFakeStore();
  service = createSettingsService({ settings: store.settingsRepo });
});

describe("settingsService", () => {
  it("saves trimmed details", async () => {
    const result = await service.update({ ...input, name: "  KK Trading  " });
    expect(result.ok && result.data.name).toBe("KK Trading");
    expect((await service.get()).email).toBe("hello@example.com");
  });

  it("validates the email and required fields", async () => {
    const result = await service.update({ ...input, name: "", email: "nope" });
    expect(result).toEqual({
      ok: false,
      fieldErrors: {
        name: "Enter the store name.",
        email: "Enter an email address like name@example.com.",
      },
    });
    expect(await store.settingsRepo.get()).toBeNull();
  });

  it("throws a helpful error when the settings row is missing", async () => {
    await expect(service.get()).rejects.toThrow("pnpm db:seed");
  });
});
