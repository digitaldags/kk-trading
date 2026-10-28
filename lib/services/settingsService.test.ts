import { beforeEach, describe, expect, it, vi } from "vitest";
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
  service = createSettingsService({
    settings: store.settingsRepo,
    imageStore: store.imageStore,
  });
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

  it("saves the slogan and second phone, and rejects them over 60 and 40 characters", async () => {
    const saved = await service.update({
      ...input,
      slogan: " FOUNDATION TO FURNISH ",
      phone2: "+639 77 698 2416",
    });
    expect(saved.ok && saved.data).toMatchObject({
      slogan: "FOUNDATION TO FURNISH",
      phone2: "+639 77 698 2416",
    });
    const tooLong = await service.update({
      ...input,
      slogan: "x".repeat(61),
      phone2: "1".repeat(41),
    });
    expect(tooLong).toEqual({
      ok: false,
      fieldErrors: {
        slogan: "Use 60 characters or fewer.",
        phone2: "Use 40 characters or fewer.",
      },
    });
  });
});

describe("settingsService logo", () => {
  const logo = (name: string) => ({
    url: `https://store.public.blob.vercel-storage.com/branding/${name}.png`,
    pathname: `branding/${name}.png`,
  });

  it("sets a logo, and keeps it when the input leaves it out", async () => {
    await service.update({ ...input, logo: logo("a") });
    const kept = await service.update({ ...input, name: "KK Trading PH" });
    expect(kept.ok && kept.data).toMatchObject({
      logoUrl: logo("a").url,
      logoPathname: logo("a").pathname,
    });
    expect(store.imageStore.deleted).toEqual([]);
  });

  it("rejects a logo outside branding/", async () => {
    const result = await service.update({
      ...input,
      logo: {
        url: "https://store.public.blob.vercel-storage.com/products/a.png",
        pathname: "products/a.png",
      },
    });
    expect(result).toEqual({
      ok: false,
      fieldErrors: { logo: "Upload the logo again." },
    });
    expect(await store.settingsRepo.get()).toBeNull();
  });

  it("deletes a replaced logo the published store doesn't show", async () => {
    await service.update({ ...input, logo: logo("a") });
    await service.update({ ...input, logo: logo("b") });
    expect((await service.get()).logoUrl).toBe(logo("b").url);
    expect(store.imageStore.deleted).toEqual([logo("a").url]);
  });

  it("keeps a replaced or removed logo while the published store shows it", async () => {
    await service.update({ ...input, logo: logo("a") });
    await store.publishRepo.publish();

    await service.update({ ...input, logo: logo("b") });
    expect(store.imageStore.deleted).toEqual([]);

    // Removed from the draft too: still published, so still kept.
    await service.update({ ...input, logo: null });
    expect((await service.get()).logoUrl).toBeNull();
    expect(store.imageStore.deleted).toEqual([logo("b").url]);
  });

  it("removes the logo with null", async () => {
    await service.update({ ...input, logo: logo("a") });
    const result = await service.update({ ...input, logo: null });
    expect(result.ok && result.data).toMatchObject({
      logoUrl: null,
      logoPathname: null,
    });
    expect(store.imageStore.deleted).toEqual([logo("a").url]);
  });

  it("keeps the old logo when the save fails", async () => {
    await service.update({ ...input, logo: logo("a") });
    store.failNextWrite();
    await expect(service.update({ ...input, logo: logo("b") })).rejects.toThrow(
      "Simulated database failure",
    );
    expect((await service.get()).logoUrl).toBe(logo("a").url);
    expect(store.imageStore.deleted).toEqual([]);
  });

  it("still saves, and logs, when the old logo can't be deleted", async () => {
    const logError = vi.fn();
    const failing = createSettingsService({
      settings: store.settingsRepo,
      imageStore: {
        delete: async () => {
          throw new Error("Blob unavailable");
        },
      },
      logError,
    });
    await failing.update({ ...input, logo: logo("a") });
    const result = await failing.update({ ...input, logo: logo("b") });
    expect(result.ok).toBe(true);
    expect(logError).toHaveBeenCalledWith(
      `Couldn't delete store logo ${logo("a").url}`,
      expect.any(Error),
    );
  });

  it("discardUnusedLogo deletes an unsaved upload, never a logo in use or another file", async () => {
    await service.update({ ...input, logo: logo("saved") });
    await service.discardUnusedLogo(logo("saved").url);
    await service.discardUnusedLogo(
      "https://store.public.blob.vercel-storage.com/products/a.webp",
    );
    await service.discardUnusedLogo(logo("unsaved").url);
    expect(store.imageStore.deleted).toEqual([logo("unsaved").url]);
  });
});
