import { beforeEach, describe, expect, it, vi } from "vitest";

// The upload route must never sign an upload without an admin session (ticket 10).
// `handleUpload` is replaced so the test sees exactly what the route would allow.

const requireAdmin = vi.fn();
vi.mock("@/lib/auth/requireAdmin", () => ({
  requireAdmin: () => requireAdmin(),
}));

type Options = {
  onBeforeGenerateToken: (pathname: string) => Promise<unknown>;
};
const handleUpload = vi.fn(async (options: Options) => ({
  type: "blob.generate-client-token",
  clientToken: "signed",
  allowed: await options.onBeforeGenerateToken("products/desk-lamp.webp"),
}));
vi.mock("@vercel/blob/client", () => ({
  handleUpload: (options: Options) => handleUpload(options),
}));

// What `unauthorized()` throws: Next's interrupts carry a digest.
class UnauthorizedInterrupt extends Error {
  digest = "NEXT_HTTP_ERROR_FALLBACK;401";
}

const { POST } = await import("./route");

const tokenRequest = (
  body: unknown = {
    type: "blob.generate-client-token",
    payload: {
      pathname: "products/desk-lamp.webp",
      clientPayload: null,
      multipart: false,
    },
  },
) =>
  new Request("http://localhost/api/blob/upload", {
    method: "POST",
    body: JSON.stringify(body),
  });

beforeEach(() => {
  requireAdmin.mockReset();
  handleUpload.mockClear();
});

describe("POST /api/blob/upload", () => {
  it("rejects a request without an admin session, issuing no token", async () => {
    requireAdmin.mockRejectedValue(new UnauthorizedInterrupt("unauthorized"));
    await expect(POST(tokenRequest())).rejects.toBeInstanceOf(
      UnauthorizedInterrupt,
    );
    expect(handleUpload).not.toHaveBeenCalled();
  });

  it("allows only product photos: WebP, JPEG or PNG up to 5 MB", async () => {
    requireAdmin.mockResolvedValue({ id: "a", email: "admin" });
    const response = await POST(tokenRequest());
    expect(response.status).toBe(200);
    expect((await response.json()).allowed).toEqual({
      allowedContentTypes: ["image/webp", "image/jpeg", "image/png"],
      maximumSizeInBytes: 5 * 1024 * 1024,
      addRandomSuffix: true,
    });
  });

  it("refuses a path outside products/", async () => {
    requireAdmin.mockResolvedValue({ id: "a", email: "admin" });
    handleUpload.mockImplementationOnce(async (options: Options) => ({
      type: "blob.generate-client-token",
      clientToken: "signed",
      allowed: await options.onBeforeGenerateToken("avatars/me.png"),
    }));
    const response = await POST(tokenRequest());
    expect(response.status).toBe(400);
  });

  it("accepts only token requests", async () => {
    requireAdmin.mockResolvedValue({ id: "a", email: "admin" });
    const response = await POST(
      tokenRequest({ type: "blob.upload-completed", payload: {} }),
    );
    expect(response.status).toBe(400);
    expect(handleUpload).not.toHaveBeenCalled();
  });
});
