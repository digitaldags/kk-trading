import { describe, expect, it, vi } from "vitest";

const del = vi.fn(async () => {});
vi.mock("@vercel/blob", () => ({ del }));

const { vercelBlobImageStore } = await import("./imageStore");

describe("vercelBlobImageStore", () => {
  it("deletes the photo from Vercel Blob by URL", async () => {
    const url = "https://store.public.blob.vercel-storage.com/products/a.webp";
    await vercelBlobImageStore.delete(url);
    expect(del).toHaveBeenCalledWith(url);
  });
});
