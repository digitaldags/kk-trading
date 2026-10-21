import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionClaims } from "@/lib/services/authService";

// requireAdmin with real tokens, and the cookie store, `unauthorized()` and the auth
// service mocked.

const cookieJar = new Map<string, string>();
const getSessionAdmin = vi.fn<(claims: SessionClaims) => Promise<unknown>>();

class Unauthorized extends Error {}

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined,
  }),
}));
vi.mock("next/navigation", () => ({
  unauthorized: () => {
    throw new Unauthorized("401");
  },
}));
vi.mock("@/lib/services", () => ({ authService: { getSessionAdmin } }));

const { getOptionalAdmin, requireAdmin } = await import("./requireAdmin");
const { SESSION_COOKIE, signSession } = await import("./session");

const ADMIN = { id: "00000000-0000-4000-8000-000000000001", email: "admin" };
const CLAIMS = { sub: ADMIN.id, pwd: 1_790_000_000_000 };

beforeEach(() => {
  vi.stubEnv("SESSION_SECRET", "test-secret-that-is-at-least-32-bytes-long");
  cookieJar.clear();
  getSessionAdmin.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("requireAdmin", () => {
  it("returns the admin for a valid session", async () => {
    cookieJar.set(SESSION_COOKIE, await signSession(CLAIMS));
    getSessionAdmin.mockResolvedValue(ADMIN);
    await expect(requireAdmin()).resolves.toEqual(ADMIN);
    expect(getSessionAdmin).toHaveBeenCalledWith(
      expect.objectContaining(CLAIMS),
    );
  });

  it("answers 401 without a cookie, without asking the database", async () => {
    await expect(requireAdmin()).rejects.toBeInstanceOf(Unauthorized);
    expect(getSessionAdmin).not.toHaveBeenCalled();
  });

  it("answers 401 for a forged token", async () => {
    cookieJar.set(SESSION_COOKIE, `${await signSession(CLAIMS)}x`);
    await expect(requireAdmin()).rejects.toBeInstanceOf(Unauthorized);
    expect(getSessionAdmin).not.toHaveBeenCalled();
  });

  it("answers 401 when the admin is gone or changed their password", async () => {
    cookieJar.set(SESSION_COOKIE, await signSession(CLAIMS));
    getSessionAdmin.mockResolvedValue(null);
    await expect(requireAdmin()).rejects.toBeInstanceOf(Unauthorized);
  });
});

describe("getOptionalAdmin", () => {
  it("returns null instead of answering 401", async () => {
    await expect(getOptionalAdmin()).resolves.toBeNull();
  });
});
