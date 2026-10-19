import { del } from "@vercel/blob";

/** Where product photos live. Injected so services can be tested without Vercel Blob. */
export interface ImageStore {
  delete(url: string): Promise<void>;
}

export const vercelBlobImageStore: ImageStore = {
  delete: (url) => del(url),
};
